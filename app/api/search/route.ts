import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { assessSafety } from '@/lib/safety'
import { buildScoreMap, lookupManufacturer } from '@/lib/manufacturer'

async function fetchAllSignals(productId: string, alternativeIds: string[]) {
  const [flagsRes, kgRes, mfrRes] = await Promise.all([
    alternativeIds.length
      ? supabaseAdmin
          .from('kg_search_feedback')
          .select('alternative_id')
          .eq('product_id', productId)
          .eq('action', 'flagged_wrong')
          .in('alternative_id', alternativeIds)
      : Promise.resolve({ data: [] }),

    supabaseAdmin
      .from('kg_ingredients')
      .select('name, is_nti, is_critical')
      .or('is_nti.eq.true,is_critical.eq.true'),

    supabaseAdmin
      .from('manufacturer_scores')
      .select('name_normalized,display_name,trust_score,regulatory_score,pricing_score,consistency_score,has_who_gmp,has_us_fda,notes'),
  ])

  const flagCount: Record<string, number> = {}
  for (const row of (flagsRes as any).data ?? []) {
    flagCount[row.alternative_id] = (flagCount[row.alternative_id] ?? 0) + 1
  }

  const ntiNames = new Set((kgRes.data ?? []).filter(r => r.is_nti).map(r => r.name))
  const criticalNames = new Set((kgRes.data ?? []).filter(r => r.is_critical).map(r => r.name))
  const manufacturerMap = buildScoreMap(mfrRes.data ?? [])

  return { flagCount, ntiNames, criticalNames, manufacturerMap }
}

export async function POST(req: NextRequest) {
  try {
    const { query, session_id } = await req.json()

    if (!query?.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const q = query.trim()

    const { data: matches, error: searchErr } = await supabaseAdmin
      .rpc('search_products', { p_query: q })
      .limit(1)

    if (searchErr) return NextResponse.json({ error: searchErr.message }, { status: 500 })

    if (!matches?.length) {
      void supabaseAdmin.from('search_logs').insert({ query: q, result_count: 0, session_id })
      return NextResponse.json({ found: false, query: q })
    }

    const product = matches[0]

    // Reject weak matches: if neither brand_name nor composition contains any word from the
    // query (≥4 chars), the fuzzy match is misleading — trigger discover instead.
    const queryWords: string[] = q.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 4)
    const brandLower = product.brand_name.toLowerCase()
    const compLower = (product.composition_text_raw ?? '').toLowerCase()
    const hasWordMatch = queryWords.length === 0 || queryWords.some(
      (w: string) => brandLower.includes(w) || compLower.includes(w)
    )
    if (!hasWordMatch) {
      void supabaseAdmin.from('search_logs').insert({ query: q, result_count: 0, session_id })
      return NextResponse.json({ found: false, query: q })
    }

    const { data: rawAlternatives, error: altErr } = await supabaseAdmin
      .rpc('find_alternatives', { p_canonical_key: product.canonical_key, p_exclude_id: product.id })

    if (altErr) return NextResponse.json({ error: altErr.message }, { status: 500 })

    const altIds = (rawAlternatives ?? []).map((a: any) => a.id)
    const signals = await fetchAllSignals(product.id, altIds)

    const alternatives = (rawAlternatives ?? []).map((alt: any) => {
      const safety = assessSafety({ product, alt, ...signals })
      const mfr = lookupManufacturer(alt.manufacturer ?? '', signals.manufacturerMap)
      return {
        ...alt,
        ...safety,
        manufacturer_trust_score: mfr?.trust_score ?? null,
        manufacturer_tier: mfr?.tier ?? 'unverified',
        manufacturer_notes: mfr?.notes ?? null,
        manufacturer_has_who_gmp: mfr?.has_who_gmp ?? false,
        manufacturer_has_us_fda: mfr?.has_us_fda ?? false,
      }
    })

    // Savings banner: cheapest SAFE alt from a trusted manufacturer first, then any safe alt
    const cheapestSafe =
      alternatives.find((a: any) => a.verdict === 'safe' && a.savings_per_unit > 0 && a.manufacturer_tier === 'trusted')
      ?? alternatives.find((a: any) => a.verdict === 'safe' && a.savings_per_unit > 0)
      ?? alternatives.find((a: any) => a.verdict === 'check_pharmacist' && a.savings_per_unit > 0)
      ?? alternatives.find((a: any) => a.savings_per_unit > 0)

    const savings = cheapestSafe
      ? {
          per_unit: +Number(cheapestSafe.savings_per_unit).toFixed(4),
          per_month_2x: +Number(cheapestSafe.savings_per_unit * 60).toFixed(2),
          pct: +Number(cheapestSafe.savings_pct).toFixed(1),
          vs_brand: cheapestSafe.brand_name,
        }
      : null

    void supabaseAdmin.from('search_logs').insert({
      query: q,
      matched_id: product.id,
      result_count: alternatives.length + 1,
      session_id,
    })

    if (alternatives.length > 0) {
      void supabaseAdmin.from('kg_search_feedback').insert(
        alternatives.map((a: any) => ({
          product_id: product.id,
          alternative_id: a.id,
          action: 'alternative_viewed',
          session_id: session_id ?? null,
          query: q,
        }))
      )
    }

    return NextResponse.json({
      found: true,
      product,
      alternatives,
      savings,
      meta: { canonical_key: product.canonical_key, total_alternatives: alternatives.length },
    })
  } catch (err) {
    console.error('Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
