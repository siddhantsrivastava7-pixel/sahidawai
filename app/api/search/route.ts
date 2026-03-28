import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

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

    const { data: alternatives, error: altErr } = await supabaseAdmin
      .rpc('find_alternatives', {
        p_canonical_key: product.canonical_key,
        p_exclude_id: product.id,
      })

    if (altErr) return NextResponse.json({ error: altErr.message }, { status: 500 })

    const cheapest = alternatives?.[0]
    const savings = cheapest && cheapest.savings_per_unit > 0
      ? {
          per_unit: +Number(cheapest.savings_per_unit).toFixed(4),
          per_month_2x: +Number(cheapest.savings_per_unit * 60).toFixed(2),
          pct: +Number(cheapest.savings_pct).toFixed(1),
          vs_brand: cheapest.brand_name,
        }
      : null

    void supabaseAdmin.from('search_logs').insert({
      query: q,
      matched_id: product.id,
      result_count: (alternatives?.length ?? 0) + 1,
      session_id,
    })

    return NextResponse.json({
      found: true,
      product,
      alternatives: alternatives ?? [],
      savings,
      meta: {
        canonical_key: product.canonical_key,
        total_alternatives: alternatives?.length ?? 0,
      },
    })
  } catch (err) {
    console.error('Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}