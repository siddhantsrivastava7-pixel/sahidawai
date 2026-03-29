import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { parseComposition, generateCanonicalKey } from '@/lib/composition-engine'
import { checkRateLimit, rateLimitHeaders } from '@/lib/ratelimit'

const DISCOVER_LIMIT = 5 // requests per IP per minute

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/html',
  'Accept-Language': 'en-IN,en;q=0.9',
}

interface OneMgProduct {
  id: string
  name: string
  manufacturer_name: string
  price: number
  pack_size_label: string // e.g. "10 tablet(s) in 1 strip"
  short_composition: string
  is_generic: boolean
}

// Parse pack size string → number of units (tablets/capsules)
function parsePackSize(label: string): number {
  const m = label.match(/(\d+)\s*(tablet|capsule|strip|unit|cap|tab)/i)
  return m ? parseInt(m[1], 10) : 10
}

async function fetch1mg(query: string): Promise<OneMgProduct[]> {
  const url = `https://www.1mg.com/api/v0/drug/search/?name=${encodeURIComponent(query)}&drug_store_available=0&es=true`
  const res = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(6000),
  })
  if (!res.ok) return []

  let json: any
  try { json = await res.json() } catch { return [] }

  // 1mg API response shape: { data: { sku_list: [...] } }
  const skuList: any[] = json?.data?.sku_list ?? []
  return skuList.slice(0, 6).map((s: any) => ({
    id: String(s.id ?? ''),
    name: s.name ?? '',
    manufacturer_name: s.manufacturer_name ?? 'Unknown',
    price: parseFloat(s.price ?? '0'),
    pack_size_label: s.pack_size_label ?? '10 tablet(s)',
    short_composition: s.short_composition ?? '',
    is_generic: Boolean(s.is_generic),
  })).filter(p => p.name && p.short_composition)
}

async function insertProducts(products: OneMgProduct[]) {
  for (const p of products) {
    const composition = p.short_composition
    const parsed = parseComposition(composition)
    if (!parsed.ingredients.length) continue

    const canonical_key = generateCanonicalKey(parsed)
    const unit_per_pack = parsePackSize(p.pack_size_label)
    const mrp = p.price
    const price_per_unit = unit_per_pack > 0 ? mrp / unit_per_pack : mrp

    // Upsert product (brand_name + canonical_key uniquely identify it)
    const { data: inserted, error } = await supabaseAdmin
      .from('products')
      .upsert({
        brand_name: p.name,
        manufacturer: p.manufacturer_name,
        composition_text_raw: composition,
        dosage_form: parsed.dosage_form,
        release_type: parsed.release_type,
        unit_per_pack,
        mrp,
        price_per_unit,
        is_generic: p.is_generic,
        is_jan_aushadhi: false,
        canonical_key,
        source: '1mg',
      }, { onConflict: 'brand_name,canonical_key', ignoreDuplicates: true })
      .select('id')
      .single()

    if (error || !inserted) continue

    // Upsert ingredients
    const ingredientRows = parsed.ingredients.map(i => ({
      product_id: inserted.id,
      ingredient: i.name,
      strength: i.strength,
      unit: i.unit,
      is_critical: false,
    }))
    if (ingredientRows.length) {
      await supabaseAdmin
        .from('product_ingredients')
        .upsert(ingredientRows, { onConflict: 'product_id,ingredient', ignoreDuplicates: true })
    }

    // Seed kg_ingredients for any new ingredient nodes
    const kgRows = parsed.ingredients.map(i => ({ name: i.name }))
    await supabaseAdmin
      .from('kg_ingredients')
      .upsert(kgRows, { onConflict: 'name', ignoreDuplicates: true })
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRateLimit(ip, DISCOVER_LIMIT)) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: rateLimitHeaders(ip, DISCOVER_LIMIT) },
    )
  }

  try {
    const { query, session_id } = await req.json()
    if (!query?.trim()) return NextResponse.json({ error: 'query required' }, { status: 400 })

    const q = query.trim()

    // Check if another concurrent request already added it
    const { data: existing } = await supabaseAdmin.rpc('search_products', { p_query: q }).limit(1)
    if (existing?.length) {
      return NextResponse.json({ already_in_db: true })
    }

    // Scrape 1mg
    const products = await fetch1mg(q)
    if (!products.length) {
      return NextResponse.json({ found: false, query: q })
    }

    // Insert into DB
    await insertProducts(products)

    // Log discovery event
    void supabaseAdmin.from('search_logs').insert({
      query: q,
      result_count: products.length,
      session_id: session_id ?? null,
      source: 'discover',
    })

    return NextResponse.json({ found: true, inserted: products.length, query: q })
  } catch (err) {
    console.error('Discover error:', err)
    return NextResponse.json({ error: 'Failed to discover medicine' }, { status: 500 })
  }
}
