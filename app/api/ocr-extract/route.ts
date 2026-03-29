import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BYTES = 10 * 1024 * 1024

// ── Public types (imported by UI) ──────────────────────────────────────────

export interface OcrGuess {
  id: string
  brand_name: string
  manufacturer: string
  price_per_unit: number
  composition_text_raw: string
}

export interface OcrCandidate {
  ocr_text: string        // exact text Claude saw on the page
  probable_name: string   // Claude's best guess at the medicine name
  confidence: number      // 0–1 from Claude
  frequency_label: string
  tabs_per_day: number
  duration_days: number
  guesses: OcrGuess[]     // top DB matches (up to 3), best first
}

export interface OcrExtractResponse {
  candidates: OcrCandidate[]
  session_id: string
}

// ── Raw Claude output shape ────────────────────────────────────────────────

interface RawMed {
  ocr_text: string
  probable_name: string
  alternative_names?: string[]
  confidence: number
  frequency_label: string
  tabs_per_day: number
  duration_days: number
}

// ── Claude extraction ──────────────────────────────────────────────────────

async function extractCandidates(base64: string, mediaType: string): Promise<RawMed[]> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1600,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType as any, data: base64 } },
        {
          type: 'text',
          text: `You are reading a handwritten doctor's prescription. Handwriting may be messy or unclear.

Return a JSON object with a single key "medicines" — an array where each item is one medicine line:

{
  "ocr_text": "the exact text as written on the prescription, even if unclear",
  "probable_name": "your best guess at the brand/generic name with strength, e.g. Augmentin 625 Tablet",
  "alternative_names": ["other possible readings if you are uncertain, e.g. Amoxyclav 625"],
  "confidence": 0.0 to 1.0,
  "frequency_label": "e.g. twice daily, once at night, thrice daily",
  "tabs_per_day": integer,
  "duration_days": integer (if not stated: antibiotics→5, chronic medicines→30, others→7)
}

Rules:
- Always include your best guess even for illegible text
- confidence < 0.5 = you can barely read it; 0.5–0.8 = somewhat uncertain; > 0.8 = confident
- Include 1-2 alternative_names if the name could be read multiple ways
- Do NOT include vitamins, dosing instructions, or non-medicine items

Return ONLY valid JSON — no markdown, no explanation.`,
        },
      ],
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return []

  try {
    const parsed = JSON.parse(match[0])
    const meds: RawMed[] = Array.isArray(parsed.medicines)
      ? parsed.medicines
          .filter((m: any) => m.probable_name && typeof m.tabs_per_day === 'number')
          .map((m: any) => ({
            ocr_text: m.ocr_text ?? m.probable_name,
            probable_name: m.probable_name,
            alternative_names: Array.isArray(m.alternative_names) ? m.alternative_names.slice(0, 2) : [],
            confidence: typeof m.confidence === 'number' ? Math.min(1, Math.max(0, m.confidence)) : 0.5,
            frequency_label: m.frequency_label ?? 'once daily',
            tabs_per_day: Math.max(1, Math.round(m.tabs_per_day ?? 1)),
            duration_days: Math.max(1, Math.round(m.duration_days ?? 7)),
          }))
      : []
    return meds
  } catch {
    return []
  }
}

// ── Fuzzy DB match ─────────────────────────────────────────────────────────

async function dbSearch(query: string): Promise<OcrGuess[]> {
  if (!query?.trim()) return []
  const { data } = await supabaseAdmin
    .rpc('search_products', { p_query: query.trim() })
    .limit(3)
  return (data ?? []).map((p: any) => ({
    id: p.id,
    brand_name: p.brand_name,
    manufacturer: p.manufacturer,
    price_per_unit: Number(p.price_per_unit),
    composition_text_raw: p.composition_text_raw ?? '',
  }))
}

async function getGuesses(med: RawMed): Promise<OcrGuess[]> {
  // Always search probable_name; also search first alt if confidence is low
  const searches: Promise<OcrGuess[]>[] = [dbSearch(med.probable_name)]
  if (med.confidence < 0.75 && med.alternative_names?.[0]) {
    searches.push(dbSearch(med.alternative_names[0]))
  }

  const results = await Promise.all(searches)
  const seen = new Set<string>()
  const merged: OcrGuess[] = []
  for (const list of results) {
    for (const g of list) {
      if (!seen.has(g.id)) { seen.add(g.id); merged.push(g) }
    }
  }
  return merged.slice(0, 3)
}

// ── Route ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let formData: FormData
  try { formData = await req.formData() } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('image')
  if (!file || !(file instanceof File)) return NextResponse.json({ error: 'No image' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'Unsupported type' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Too large' }, { status: 400 })

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')

  const rawMeds = await extractCandidates(base64, file.type)
  if (!rawMeds.length) {
    return NextResponse.json({ error: 'Could not read any medicines from this image.' }, { status: 422 })
  }

  // Fuzzy-match all medicines in parallel
  const guessResults = await Promise.all(rawMeds.slice(0, 8).map(m => getGuesses(m)))

  const candidates: OcrCandidate[] = rawMeds.slice(0, 8).map((m, i) => ({
    ocr_text: m.ocr_text,
    probable_name: m.probable_name,
    confidence: m.confidence,
    frequency_label: m.frequency_label,
    tabs_per_day: m.tabs_per_day,
    duration_days: m.duration_days,
    guesses: guessResults[i],
  }))

  const session_id = Math.random().toString(36).slice(2)

  return NextResponse.json({ candidates, session_id } satisfies OcrExtractResponse)
}
