import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { assessSafety } from '@/lib/safety'

async function fetchKgSignals(productId: string, alternativeIds: string[]) {
  const [flagsRes, kgRes] = await Promise.all([
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
  ])

  const flagCount: Record<string, number> = {}
  for (const row of (flagsRes as any).data ?? []) {
    flagCount[row.alternative_id] = (flagCount[row.alternative_id] ?? 0) + 1
  }

  const ntiNames = new Set((kgRes.data ?? []).filter(r => r.is_nti).map(r => r.name))
  const criticalNames = new Set((kgRes.data ?? []).filter(r => r.is_critical).map(r => r.name))

  return { flagCount, ntiNames, criticalNames }
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

    const { data: rawAlternatives, error: altErr } = await supabaseAdmin
      .rpc('find_alternatives', { p_canonical_key: product.canonical_key, p_exclude_id: product.id })

    if (altErr) return NextResponse.json({ error: altErr.message }, { status: 500 })

    const altIds = (rawAlternatives ?? []).map((a: any) => a.id)
    const kgSignals = await fetchKgSignals(product.id, altIds)

    const alternatives = (rawAlternatives ?? []).map((alt: any) => {
      const safety = assessSafety({ product, alt, ...kgSignals })
      return { ...alt, ...safety }
    })

    // Savings banner: cheapest safe alternative
    const cheapestSafe = alternatives.find((a: any) => a.verdict === 'safe' && a.savings_per_unit > 0)
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
