import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { Product, SubstitutionWarning } from '@/types'

// Narrow therapeutic index drugs — substitution requires physician oversight
const NTI_DRUGS = [
  'warfarin', 'digoxin', 'phenytoin', 'carbamazepine', 'valproate',
  'lithium', 'cyclosporine', 'tacrolimus', 'levothyroxine', 'thyroxine',
  'theophylline', 'methotrexate', 'clonidine', 'amiodarone',
]

const EXTENDED_RELEASE_RE = /\b(SR|XR|ER|CR|LA|CD|TR|MR|RETARD|PROLONGED)\b/i

function inferReleaseType(brandName: string, releaseType: string | null | undefined): string {
  if (releaseType && releaseType.trim()) return releaseType.trim().toUpperCase()
  return EXTENDED_RELEASE_RE.test(brandName) ? 'SR' : 'IR'
}

// Extract the primary strength number from a brand name (e.g. "Augmentin 625" → 625)
function extractBrandStrength(brandName: string): number | null {
  // Match the first standalone number of 2+ digits — typically the total strength
  const m = brandName.match(/\b(\d{2,4}(?:\.\d+)?)\b/)
  return m ? parseFloat(m[1]) : null
}

function scoreAlternative(
  product: Product & { brand_name: string },
  alt: { brand_name: string; release_type: string; dosage_form: string },
) {
  const warnings: SubstitutionWarning[] = []
  let score = 95

  // Release type mismatch: IR↔SR/XR/CR/ER is never safe to substitute unilaterally
  // Fall back to name-based inference when the DB column is empty
  const productRT = inferReleaseType(product.brand_name, product.release_type)
  const altRT = inferReleaseType(alt.brand_name, alt.release_type)
  if (altRT !== productRT) {
    warnings.push('release_type_mismatch')
    score = 15
  }

  // Strength mismatch: different dose of the active ingredient (e.g. 625mg vs 375mg)
  const productStrength = extractBrandStrength(product.brand_name)
  const altStrength = extractBrandStrength(alt.brand_name)
  if (productStrength !== null && altStrength !== null && productStrength !== altStrength) {
    warnings.push('strength_mismatch')
    score = Math.min(score, 20)
  }

  // Narrow therapeutic index
  const compLower = product.composition_text_raw.toLowerCase()
  if (NTI_DRUGS.some(d => compLower.includes(d))) {
    warnings.push('narrow_therapeutic_index')
    score = Math.min(score, 55)
  }

  // Critical ingredient flagged in DB
  if (product.ingredients?.some(i => i.is_critical)) {
    warnings.push('critical_drug')
    score = Math.min(score, 50)
  }

  return {
    confidence_score: score,
    substitution_warnings: warnings,
    is_safe_substitute: score >= 70,
  }
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
      .rpc('find_alternatives', {
        p_canonical_key: product.canonical_key,
        p_exclude_id: product.id,
      })

    if (altErr) return NextResponse.json({ error: altErr.message }, { status: 500 })

    // Enrich each alternative with confidence score + safety warnings
    const alternatives = (rawAlternatives ?? []).map((alt: any) => ({
      ...alt,
      ...scoreAlternative(product, alt),
    }))

    // Savings banner uses cheapest SAFE alternative
    const cheapestSafe = alternatives.find((a: any) => a.is_safe_substitute && a.savings_per_unit > 0)
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

    // Log impressions for each alternative shown (fire-and-forget)
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
      meta: {
        canonical_key: product.canonical_key,
        total_alternatives: alternatives.length,
      },
    })
  } catch (err) {
    console.error('Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
