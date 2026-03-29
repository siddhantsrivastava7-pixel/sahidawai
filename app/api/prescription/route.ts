import Anthropic from '@anthropic-ai/sdk'
import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { Product, Alternative } from '@/types'
import { assessSafety } from '@/lib/safety'

const client = new Anthropic()

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BYTES = 10 * 1024 * 1024

export interface PrescriptionItem {
  name: string
  frequency_label: string
  tabs_per_day: number
  duration_days: number
  tabs_per_course: number
  found: boolean
  product?: Product
  alternatives?: Alternative[]
  course_cost?: number
  cheapest_course_cost?: number
  course_savings?: number
}

export interface PrescriptionAnalysis {
  items: PrescriptionItem[]
  total_current_cost: number
  total_cheapest_cost: number
  total_savings: number
}

// ── Anonymization ──────────────────────────────────────────────────────────

interface PrescriberSignals {
  doctor_name: string | null
  city: string | null
  speciality_hint: string | null
}

function hashPrescriber(name: string, city: string): string {
  const canonical = `${name.toLowerCase().trim()}|${city.toLowerCase().trim()}`
  return createHash('sha256').update(canonical).digest('hex')
}

// ── OCR: structured extraction ─────────────────────────────────────────────

interface OcrMedicine {
  name: string
  frequency_label: string
  tabs_per_day: number
  duration_days: number
}

interface OcrResult {
  medicines: OcrMedicine[]
  prescriber: PrescriberSignals
}

async function extractFromImage(base64: string, mediaType: string): Promise<OcrResult> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1200,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType as any, data: base64 } },
        {
          type: 'text',
          text: `Analyse this prescription image and return a single JSON object with two keys:

"prescriber": {
  "doctor_name": doctor's name if visible (string or null),
  "city": city/location if visible (string or null),
  "speciality_hint": infer from medicines — e.g. "diabetologist", "cardiologist", "general" (string or null)
}

"medicines": array of objects, one per medicine:
  - name: brand name with strength (e.g. "Augmentin 625 Tablet")
  - frequency_label: human-readable (e.g. "twice daily")
  - tabs_per_day: integer
  - duration_days: integer (chronic/not stated → 30; antibiotics → 5)

Return ONLY valid JSON, nothing else.`,
        },
      ],
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return { medicines: [], prescriber: { doctor_name: null, city: null, speciality_hint: null } }

  try {
    const parsed = JSON.parse(match[0])
    const medicines: OcrMedicine[] = Array.isArray(parsed.medicines)
      ? parsed.medicines.filter((m: any) => m.name && m.tabs_per_day)
      : []
    const prescriber: PrescriberSignals = {
      doctor_name: parsed.prescriber?.doctor_name ?? null,
      city: parsed.prescriber?.city ?? null,
      speciality_hint: parsed.prescriber?.speciality_hint ?? null,
    }
    return { medicines, prescriber }
  } catch {
    return { medicines: [], prescriber: { doctor_name: null, city: null, speciality_hint: null } }
  }
}

// ── Prescriber profile upsert ──────────────────────────────────────────────

async function upsertPrescriber(signals: PrescriberSignals): Promise<string | null> {
  if (!signals.doctor_name || !signals.city) return null

  const prescriber_id = hashPrescriber(signals.doctor_name, signals.city)

  await supabaseAdmin.from('prescriber_profiles').upsert({
    prescriber_id,
    city: signals.city,
    speciality_hint: signals.speciality_hint,
    last_seen_at: new Date().toISOString(),
    prescription_count: 1,
  }, {
    onConflict: 'prescriber_id',
    ignoreDuplicates: false,
  })

  // Increment prescription count separately (upsert doesn't support increments)
  await supabaseAdmin.rpc('increment_prescriber_count', { p_id: prescriber_id }).maybeSingle()

  return prescriber_id
}

// ── Store prescription events (fire-and-forget) ────────────────────────────

async function storePrescriptionEvents(
  items: PrescriptionItem[],
  prescriberId: string | null,
  sessionId: string,
) {
  const rows = items
    .filter(i => i.found && i.product)
    .map(i => {
      const ppu = Number(i.product!.price_per_unit)
      const cheapestAlt = i.alternatives?.find(a => a.verdict === 'safe' && a.savings_per_unit > 0)
        ?? i.alternatives?.find(a => a.verdict === 'check_pharmacist' && a.savings_per_unit > 0)

      const cheapest_safe_ppu = cheapestAlt ? Number(cheapestAlt.price_per_unit) : null
      const cost_premium_pct = cheapestAlt
        ? Math.round(((ppu - Number(cheapestAlt.price_per_unit)) / Number(cheapestAlt.price_per_unit)) * 100 * 10) / 10
        : 0

      return {
        prescriber_id: prescriberId,
        product_id: i.product!.id,
        brand_name: i.product!.brand_name,
        canonical_key: i.product!.canonical_key,
        prescribed_ppu: ppu,
        cheapest_safe_ppu,
        cheapest_safe_brand: cheapestAlt?.brand_name ?? null,
        cost_premium_pct,
        is_cheapest: !cheapestAlt || ppu <= (cheapest_safe_ppu ?? ppu),
        verdict: cheapestAlt?.verdict ?? 'safe',
        session_id: sessionId,
      }
    })

  if (rows.length) {
    await supabaseAdmin.from('prescription_events').insert(rows)
  }
}

// ── Search one medicine ────────────────────────────────────────────────────

async function searchMedicine(
  med: OcrMedicine,
  ntiNames: Set<string>,
): Promise<PrescriptionItem> {
  const tabs = Math.max(1, Math.round(med.tabs_per_day)) * Math.max(1, med.duration_days)
  const base: PrescriptionItem = {
    name: med.name,
    frequency_label: med.frequency_label,
    tabs_per_day: med.tabs_per_day,
    duration_days: med.duration_days,
    tabs_per_course: tabs,
    found: false,
  }

  const { data: matches } = await supabaseAdmin
    .rpc('search_products', { p_query: med.name })
    .limit(1)

  if (!matches?.length) return base

  const product: Product = matches[0]

  const { data: rawAlts } = await supabaseAdmin
    .rpc('find_alternatives', { p_canonical_key: product.canonical_key, p_exclude_id: product.id })

  const altIds = (rawAlts ?? []).map((a: any) => a.id)

  const [flagRes, critRes] = await Promise.all([
    altIds.length
      ? supabaseAdmin
          .from('kg_search_feedback')
          .select('alternative_id')
          .eq('product_id', product.id)
          .eq('action', 'flagged_wrong')
          .in('alternative_id', altIds)
      : Promise.resolve({ data: [] as any[] }),
    supabaseAdmin
      .from('kg_ingredients')
      .select('name, is_nti, is_critical')
      .or('is_nti.eq.true,is_critical.eq.true'),
  ])

  const flagCount: Record<string, number> = {}
  for (const row of (flagRes as any).data ?? []) {
    flagCount[row.alternative_id] = (flagCount[row.alternative_id] ?? 0) + 1
  }
  const criticalNames = new Set((critRes.data ?? []).filter(r => r.is_critical).map(r => r.name))

  const alternatives: Alternative[] = (rawAlts ?? []).map((alt: any) => ({
    ...alt,
    ...assessSafety({ product, alt, flagCount, ntiNames, criticalNames }),
  }))

  const ppu = Number(product.price_per_unit)
  const course_cost = ppu * tabs

  const cheapestSafe = alternatives.find(a => a.verdict === 'safe' && a.savings_per_unit > 0)
    ?? alternatives.find(a => a.verdict === 'check_pharmacist' && a.savings_per_unit > 0)
    ?? alternatives.find(a => a.savings_per_unit > 0)

  const cheapest_ppu = cheapestSafe ? Number(cheapestSafe.price_per_unit) : ppu
  const cheapest_course_cost = cheapest_ppu * tabs
  const course_savings = course_cost - cheapest_course_cost

  return { ...base, found: true, product, alternatives, course_cost, cheapest_course_cost, course_savings }
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let formData: FormData
  try { formData = await req.formData() } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('image')
  if (!file || !(file instanceof File)) return NextResponse.json({ error: 'No image' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'Unsupported type' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Too large' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const base64 = buffer.toString('base64')

  // Step 1: OCR — medicines + prescriber signals in one Claude call
  const { medicines, prescriber } = await extractFromImage(base64, file.type)
  if (!medicines.length) return NextResponse.json({ error: 'No medicines found' }, { status: 422 })

  // Step 2: NTI list
  const { data: ntiRows } = await supabaseAdmin.from('kg_ingredients').select('name').eq('is_nti', true)
  const ntiNames = new Set((ntiRows ?? []).map(r => r.name))

  // Step 3: search all medicines in parallel
  const sessionId = Math.random().toString(36).slice(2)
  const items = await Promise.all(medicines.slice(0, 8).map(m => searchMedicine(m, ntiNames)))

  // Step 4: aggregate totals
  const found = items.filter(i => i.found)
  const total_current_cost = found.reduce((s, i) => s + (i.course_cost ?? 0), 0)
  const total_cheapest_cost = found.reduce((s, i) => s + (i.cheapest_course_cost ?? 0), 0)
  const total_savings = total_current_cost - total_cheapest_cost

  // Step 5: store behavior data (fire-and-forget — never blocks response)
  void (async () => {
    const prescriberId = await upsertPrescriber(prescriber)
    await storePrescriptionEvents(items, prescriberId, sessionId)
  })()

  return NextResponse.json({
    items,
    total_current_cost,
    total_cheapest_cost,
    total_savings,
  } satisfies PrescriptionAnalysis)
}
