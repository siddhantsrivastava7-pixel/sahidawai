import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { Product, Alternative, SubstitutionWarning } from '@/types'

const client = new Anthropic()

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BYTES = 10 * 1024 * 1024
const EXTENDED_RELEASE_RE = /\b(SR|XR|ER|CR|LA|CD|TR|MR|RETARD|PROLONGED)\b/i

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

// ── Scoring (mirrors app/api/search/route.ts) ─────────────────────────────

function inferReleaseType(brandName: string, rt: string | null | undefined) {
  if (rt?.trim()) return rt.trim().toUpperCase()
  return EXTENDED_RELEASE_RE.test(brandName) ? 'SR' : 'IR'
}

function extractStrength(name: string) {
  const m = name.match(/\b(\d{2,4}(?:\.\d+)?)\b/)
  return m ? parseFloat(m[1]) : null
}

function scoreAlt(
  product: Product,
  alt: any,
  flagCount: Record<string, number>,
  ntiNames: Set<string>,
): { confidence_score: number; substitution_warnings: SubstitutionWarning[]; is_safe_substitute: boolean } {
  const warnings: SubstitutionWarning[] = []
  let score = 95

  if ((flagCount[alt.id] ?? 0) >= 3) { warnings.push('user_flagged'); score = 5 }

  const pRT = inferReleaseType(product.brand_name, product.release_type)
  const aRT = inferReleaseType(alt.brand_name, alt.release_type)
  if (pRT !== aRT) { warnings.push('release_type_mismatch'); score = Math.min(score, 15) }

  const pS = extractStrength(product.brand_name)
  const aS = extractStrength(alt.brand_name)
  if (pS !== null && aS !== null && pS !== aS) { warnings.push('strength_mismatch'); score = Math.min(score, 20) }

  const comp = product.composition_text_raw.toLowerCase()
  const ingNames = (product.ingredients ?? []).map(i => i.ingredient.toLowerCase().trim())
  if (ingNames.some(n => ntiNames.has(n)) || comp.split(/[\s,+]+/).some(w => ntiNames.has(w))) {
    warnings.push('narrow_therapeutic_index'); score = Math.min(score, 55)
  }
  if (product.ingredients?.some(i => i.is_critical)) {
    warnings.push('critical_drug'); score = Math.min(score, 50)
  }

  return { confidence_score: score, substitution_warnings: warnings, is_safe_substitute: score >= 70 }
}

// ── OCR: extract structured medicine list ─────────────────────────────────

interface OcrMedicine {
  name: string
  frequency_label: string
  tabs_per_day: number
  duration_days: number
}

async function extractMedicinesFromImage(base64: string, mediaType: string): Promise<OcrMedicine[]> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType as any, data: base64 } },
        {
          type: 'text',
          text: `Analyse this prescription image. For each medicine prescribed, extract:
- name: brand name with strength (e.g. "Augmentin 625 Tablet", "Pantoprazole 40mg")
- frequency_label: human-readable (e.g. "twice daily", "once at night", "three times daily")
- tabs_per_day: number of tablets/capsules per day (integer)
- duration_days: number of days prescribed (integer; if chronic/not stated use 30; for antibiotics default to 5)

Return ONLY a valid JSON array, nothing else. Example:
[
  {"name":"Augmentin 625 Tablet","frequency_label":"twice daily","tabs_per_day":2,"duration_days":5},
  {"name":"Pantoprazole 40mg","frequency_label":"once daily","tabs_per_day":1,"duration_days":30}
]`,
        },
      ],
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return []
  try {
    const arr = JSON.parse(match[0])
    return Array.isArray(arr) ? arr.filter((m: any) => m.name && m.tabs_per_day) : []
  } catch {
    return []
  }
}

// ── Search one medicine and build a PrescriptionItem ─────────────────────

async function searchMedicine(
  med: OcrMedicine,
  ntiNames: Set<string>,
  sessionId: string,
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

  // Fetch flag counts for alternatives
  const altIds = (rawAlts ?? []).map((a: any) => a.id)
  const { data: flagRows } = altIds.length
    ? await supabaseAdmin
        .from('kg_search_feedback')
        .select('alternative_id')
        .eq('product_id', product.id)
        .eq('action', 'flagged_wrong')
        .in('alternative_id', altIds)
    : { data: [] }

  const flagCount: Record<string, number> = {}
  for (const row of flagRows ?? []) {
    flagCount[row.alternative_id] = (flagCount[row.alternative_id] ?? 0) + 1
  }

  const alternatives: Alternative[] = (rawAlts ?? []).map((alt: any) => ({
    ...alt,
    ...scoreAlt(product, alt, flagCount, ntiNames),
  }))

  const ppu = Number(product.price_per_unit)
  const course_cost = ppu * tabs

  const cheapestSafe = alternatives.find(a => a.is_safe_substitute && a.savings_per_unit > 0)
    ?? alternatives.find(a => a.savings_per_unit > 0)

  const cheapest_ppu = cheapestSafe ? Number(cheapestSafe.price_per_unit) : ppu
  const cheapest_course_cost = cheapest_ppu * tabs
  const course_savings = course_cost - cheapest_course_cost

  return {
    ...base,
    found: true,
    product,
    alternatives,
    course_cost,
    cheapest_course_cost,
    course_savings,
  }
}

// ── Route handler ─────────────────────────────────────────────────────────

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
  const mediaType = file.type

  // Step 1: structured OCR
  const medicines = await extractMedicinesFromImage(base64, mediaType)
  if (!medicines.length) return NextResponse.json({ error: 'No medicines found' }, { status: 422 })

  // Step 2: fetch NTI list from KG once
  const { data: ntiRows } = await supabaseAdmin
    .from('kg_ingredients')
    .select('name')
    .eq('is_nti', true)
  const ntiNames = new Set((ntiRows ?? []).map(r => r.name))

  // Step 3: search all medicines in parallel (cap at 8)
  const sessionId = Math.random().toString(36).slice(2)
  const items = await Promise.all(
    medicines.slice(0, 8).map(m => searchMedicine(m, ntiNames, sessionId))
  )

  // Step 4: aggregate totals (only found medicines)
  const found = items.filter(i => i.found)
  const total_current_cost = found.reduce((s, i) => s + (i.course_cost ?? 0), 0)
  const total_cheapest_cost = found.reduce((s, i) => s + (i.cheapest_course_cost ?? 0), 0)
  const total_savings = total_current_cost - total_cheapest_cost

  const analysis: PrescriptionAnalysis = {
    items,
    total_current_cost,
    total_cheapest_cost,
    total_savings,
  }

  return NextResponse.json(analysis)
}
