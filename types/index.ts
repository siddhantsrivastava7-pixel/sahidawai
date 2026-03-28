export interface Ingredient {
  ingredient: string
  strength: number
  unit: string
  is_critical: boolean
}

export interface Product {
  id: string
  brand_name: string
  manufacturer: string
  composition_text_raw: string
  dosage_form: string
  release_type: string
  unit_per_pack: number
  mrp: number
  price_per_unit: number
  is_generic: boolean
  is_jan_aushadhi: boolean
  manufacturer_trust_score: number | null
  cdsco_approved: boolean
  composition_id: string
  canonical_key: string
  ingredients: Ingredient[]
}

export type SubstitutionWarning =
  | 'release_type_mismatch'
  | 'narrow_therapeutic_index'
  | 'critical_drug'

export interface Alternative {
  id: string
  brand_name: string
  manufacturer: string
  unit_per_pack: number
  mrp: number
  price_per_unit: number
  is_generic: boolean
  is_jan_aushadhi: boolean
  savings_per_unit: number
  savings_pct: number
  release_type: string
  dosage_form: string
  // computed server-side
  confidence_score: number
  substitution_warnings: SubstitutionWarning[]
  is_safe_substitute: boolean
}

export interface Savings {
  per_unit: number
  per_month_2x: number
  pct: number
  vs_brand: string
}

export interface SearchResult {
  found: boolean
  query: string
  product?: Product
  alternatives?: Alternative[]
  savings?: Savings | null
  meta?: {
    canonical_key: string
    total_alternatives: number
  }
}