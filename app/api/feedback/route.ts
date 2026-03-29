import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, rateLimitHeaders } from '@/lib/ratelimit'

const FEEDBACK_LIMIT = 20 // requests per IP per minute

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRateLimit(ip, FEEDBACK_LIMIT)) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: rateLimitHeaders(ip, FEEDBACK_LIMIT) },
    )
  }

  try {
    const { product_id, alternative_id, action, reason, note, session_id, query } = await req.json()

    if (!action) return NextResponse.json({ error: 'action required' }, { status: 400 })

    const validActions = ['alternative_viewed', 'flagged_wrong', 'flagged_correct']
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: 'invalid action' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from('kg_search_feedback').insert({
      product_id: product_id ?? null,
      alternative_id: alternative_id ?? null,
      action,
      reason: reason ?? null,
      note: note ?? null,
      session_id: session_id ?? null,
      query: query ?? null,
    })

    if (error) {
      console.error('Feedback insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // If enough flags accumulate for a pair, auto-create a not_substitutable edge
    if (action === 'flagged_wrong' && product_id && alternative_id) {
      void autoPromoteFlag(product_id, alternative_id)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Feedback error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// If 3+ users flag the same pair as wrong → create a not_substitutable edge in the graph
async function autoPromoteFlag(productId: string, alternativeId: string) {
  const { count } = await supabaseAdmin
    .from('kg_search_feedback')
    .select('*', { count: 'exact', head: true })
    .eq('alternative_id', alternativeId)
    .eq('action', 'flagged_wrong')

  if ((count ?? 0) >= 3) {
    // Get the ingredient names for both products
    const { data: products } = await supabaseAdmin
      .from('product_ingredients')
      .select('ingredient, product_id')
      .in('product_id', [productId, alternativeId])

    if (!products?.length) return

    const byProduct: Record<string, string[]> = {}
    for (const row of products) {
      if (!byProduct[row.product_id]) byProduct[row.product_id] = []
      byProduct[row.product_id].push(row.ingredient.toLowerCase().trim())
    }

    const fromIngredients = byProduct[productId] ?? []
    const toIngredients = byProduct[alternativeId] ?? []

    // Find shared ingredients — these are the pair to flag not_substitutable
    const shared = fromIngredients.filter(i => toIngredients.includes(i))
    if (!shared.length) return

    for (const ingredientName of shared) {
      const { data: fromNode } = await supabaseAdmin
        .from('kg_ingredients')
        .select('id')
        .eq('name', ingredientName)
        .single()

      if (!fromNode) continue

      // Record that this ingredient pair was flagged — add a self-referential not_substitutable
      // In practice, the product_id pair is what matters; we log in metadata
      await supabaseAdmin.from('kg_relationships').upsert({
        from_id: fromNode.id,
        to_id: fromNode.id,
        rel_type: 'not_substitutable',
        metadata: { product_pair: [productId, alternativeId], auto_promoted: true },
        confidence: 0.9,
        source: 'feedback',
      }, { onConflict: 'from_id,to_id,rel_type', ignoreDuplicates: true })
    }
  }
}
