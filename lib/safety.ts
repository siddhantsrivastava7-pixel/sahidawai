/**
 * Safety + Trust Engine
 *
 * Produces a 4-tier verdict for every alternative with a plain-English explanation.
 * Rules are applied in descending severity order — first match wins.
 *
 * Verdicts:
 *   safe              → ✅ Same composition, same strength, same form
 *   check_pharmacist  → ⚠️  Minor difference; pharmacist can advise
 *   check_doctor      → ⚠️  NTI / critical drug; physician must approve
 *   do_not_substitute → ❌  Different release, dose, or user-flagged as wrong
 */

import { SubstitutionWarning } from '@/types'

export type SafetyVerdict = 'safe' | 'check_pharmacist' | 'check_doctor' | 'do_not_substitute'

export interface SafetyResult {
  verdict: SafetyVerdict
  explanation: string          // One sentence, shown to the user
  substitution_warnings: SubstitutionWarning[]
  confidence_score: number     // Numeric for backward compat + sorting
  is_safe_substitute: boolean  // Backward compat
}

// ── Verdict metadata (for UI) ─────────────────────────────────────────────

export const VERDICT_META: Record<SafetyVerdict, {
  icon: string
  label: string
  color: string        // Tailwind text+bg+border classes for the badge
  borderColor: string  // Card left-border colour
}> = {
  safe: {
    icon: '✅',
    label: 'Safe to discuss with pharmacist',
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    borderColor: 'border-l-emerald-400',
  },
  check_pharmacist: {
    icon: '⚠️',
    label: 'Check with pharmacist',
    color: 'text-amber-700 bg-amber-50 border-amber-200',
    borderColor: 'border-l-amber-400',
  },
  check_doctor: {
    icon: '⚠️',
    label: 'Consult your doctor first',
    color: 'text-orange-700 bg-orange-50 border-orange-200',
    borderColor: 'border-l-orange-400',
  },
  do_not_substitute: {
    icon: '❌',
    label: 'Do NOT substitute',
    color: 'text-red-700 bg-red-50 border-red-200',
    borderColor: 'border-l-red-400',
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────

const EXTENDED_RELEASE_RE = /\b(SR|XR|ER|CR|LA|CD|TR|MR|RETARD|PROLONGED)\b/i

export function inferReleaseType(brandName: string, rt: string | null | undefined): string {
  if (rt?.trim()) return rt.trim().toUpperCase()
  return EXTENDED_RELEASE_RE.test(brandName) ? 'SR' : 'IR'
}

export function extractStrength(name: string): number | null {
  const m = name.match(/\b(\d{2,4}(?:\.\d+)?)\b/)
  return m ? parseFloat(m[1]) : null
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function describeIngredients(
  ingredients: { ingredient: string; strength: number; unit: string }[],
  compositionRaw: string,
): string {
  if (ingredients?.length) {
    return ingredients
      .map(i => `${capitalize(i.ingredient)} ${i.strength}${i.unit}`)
      .join(' + ')
  }
  // Trim long composition text
  return compositionRaw.length > 80 ? compositionRaw.slice(0, 77) + '…' : compositionRaw
}

function releaseLabel(rt: string): string {
  const map: Record<string, string> = {
    SR: 'sustained-release (SR)',
    XR: 'extended-release (XR)',
    ER: 'extended-release (ER)',
    CR: 'controlled-release (CR)',
    LA: 'long-acting (LA)',
    MR: 'modified-release (MR)',
    IR: 'immediate-release',
  }
  return map[rt] ?? rt
}

// ── Core assessment function ───────────────────────────────────────────────

export interface AssessmentInput {
  product: {
    brand_name: string
    release_type?: string | null
    composition_text_raw: string
    dosage_form?: string
    ingredients?: { ingredient: string; strength: number; unit: string; is_critical: boolean }[]
  }
  alt: {
    id: string
    brand_name: string
    release_type?: string | null
    dosage_form?: string
  }
  flagCount: Record<string, number>   // from kg_search_feedback
  ntiNames: Set<string>               // from kg_ingredients
  criticalNames: Set<string>          // from kg_ingredients
}

export function assessSafety(input: AssessmentInput): SafetyResult {
  const { product, alt, flagCount, ntiNames, criticalNames } = input
  const warnings: SubstitutionWarning[] = []

  // ── Rule 1: User-flagged ───────────────────────────────────────────────
  if ((flagCount[alt.id] ?? 0) >= 3) {
    return {
      verdict: 'do_not_substitute',
      explanation: 'Multiple users have flagged this as a wrong alternative. Avoid until independently verified.',
      substitution_warnings: ['user_flagged'],
      confidence_score: 5,
      is_safe_substitute: false,
    }
  }

  // ── Rule 2: Release type mismatch (highest clinical risk) ─────────────
  const productRT = inferReleaseType(product.brand_name, product.release_type)
  const altRT = inferReleaseType(alt.brand_name, alt.release_type)

  if (productRT !== altRT) {
    warnings.push('release_type_mismatch')
    const prescribed = releaseLabel(productRT)
    const offered = releaseLabel(altRT)
    return {
      verdict: 'do_not_substitute',
      explanation: `Your prescription is for a ${prescribed} tablet; this is ${offered}. Modified-release formulations control how fast the drug enters your bloodstream — swapping them changes the clinical effect and requires a new prescription.`,
      substitution_warnings: warnings,
      confidence_score: 12,
      is_safe_substitute: false,
    }
  }

  // ── Rule 3: Strength / dose mismatch ──────────────────────────────────
  const pStrength = extractStrength(product.brand_name)
  const aStrength = extractStrength(alt.brand_name)

  if (pStrength !== null && aStrength !== null && pStrength !== aStrength) {
    warnings.push('strength_mismatch')
    return {
      verdict: 'do_not_substitute',
      explanation: `This product contains ${aStrength}mg but your prescription calls for ${pStrength}mg. A different dose is not interchangeable — you would need a new prescription for this strength.`,
      substitution_warnings: warnings,
      confidence_score: 18,
      is_safe_substitute: false,
    }
  }

  // ── Rule 4: Narrow therapeutic index ──────────────────────────────────
  const ingNames = (product.ingredients ?? []).map(i => i.ingredient.toLowerCase().trim())
  const compWords = product.composition_text_raw.toLowerCase().split(/[\s,+()]+/)
  const isNti = ingNames.some(n => ntiNames.has(n)) || compWords.some(w => ntiNames.has(w))

  if (isNti) {
    warnings.push('narrow_therapeutic_index')
    const ntiDrug = ingNames.find(n => ntiNames.has(n)) ?? 'This medication'
    return {
      verdict: 'check_doctor',
      explanation: `${capitalize(ntiDrug)} is a narrow therapeutic index (NTI) drug — even a small variation in dose or formulation between brands can cause toxicity or loss of therapeutic effect. Never switch brands without your doctor's explicit approval.`,
      substitution_warnings: warnings,
      confidence_score: 42,
      is_safe_substitute: false,
    }
  }

  // ── Rule 5: Critical drug flagged in DB ───────────────────────────────
  const isCritical = ingNames.some(n => criticalNames.has(n))
    || (product.ingredients ?? []).some(i => i.is_critical)

  if (isCritical) {
    warnings.push('critical_drug')
    return {
      verdict: 'check_doctor',
      explanation: 'This is a critical medication where brand-to-brand differences in inactive ingredients or manufacturing can matter. Consult your doctor before switching.',
      substitution_warnings: warnings,
      confidence_score: 40,
      is_safe_substitute: false,
    }
  }

  // ── Rule 6: Dosage form mismatch (e.g. tablet vs capsule) ─────────────
  const productForm = (product.dosage_form ?? '').toLowerCase()
  const altForm = (alt.dosage_form ?? '').toLowerCase()
  if (productForm && altForm && productForm !== altForm) {
    warnings.push('release_type_mismatch') // closest existing warning
    return {
      verdict: 'check_pharmacist',
      explanation: `Your prescription is for a ${productForm}; this is a ${altForm}. The dosage form is different — absorption can vary. Confirm with your pharmacist that switching is appropriate for you.`,
      substitution_warnings: warnings,
      confidence_score: 55,
      is_safe_substitute: false,
    }
  }

  // ── Rule 7: Safe — same composition, strength, form ───────────────────
  const ingDesc = describeIngredients(product.ingredients ?? [], product.composition_text_raw)
  const formDesc = productForm || 'tablet'

  return {
    verdict: 'safe',
    explanation: `Same active ingredient${(product.ingredients?.length ?? 0) > 1 ? 's' : ''} (${ingDesc}), same dose, same ${formDesc} form — generally safe to discuss switching with your pharmacist.`,
    substitution_warnings: [],
    confidence_score: 92,
    is_safe_substitute: true,
  }
}
