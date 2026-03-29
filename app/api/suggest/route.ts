import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export interface SuggestionItem {
  id: string
  brand_name: string
  manufacturer: string
  price_per_unit: number
  dosage_form: string
  composition_text_raw: string
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json([])

  const { data, error } = await supabaseAdmin
    .rpc('search_products', { p_query: q })
    .limit(8)

  if (error || !data) return NextResponse.json([])

  const items: SuggestionItem[] = data.map((p: any) => ({
    id: p.id,
    brand_name: p.brand_name,
    manufacturer: p.manufacturer,
    price_per_unit: Number(p.price_per_unit),
    dosage_form: p.dosage_form,
    composition_text_raw: p.composition_text_raw,
  }))

  return NextResponse.json(items, {
    headers: { 'Cache-Control': 'private, max-age=60' },
  })
}
