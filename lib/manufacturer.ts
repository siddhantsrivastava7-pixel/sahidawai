/**
 * Manufacturer Trust Score
 *
 * Three tiers derived from trust_score (0–100):
 *   trusted    80+  → shield icon, green
 *   standard   50–79 → standard badge, gray
 *   unverified <50   → warning, amber
 *
 * Score components (weighted average):
 *   regulatory_score  × 0.45  — CDSCO history, recalls, import alerts
 *   pricing_score     × 0.30  — fair pricing vs generic equivalents
 *   consistency_score × 0.25  — product range quality consistency
 */

export type ManufacturerTier = 'trusted' | 'standard' | 'unverified'

export interface ManufacturerScore {
  name_normalized: string
  display_name: string | null
  trust_score: number
  regulatory_score: number
  pricing_score: number
  consistency_score: number
  has_who_gmp: boolean
  has_us_fda: boolean
  notes: string | null
  tier: ManufacturerTier
  tier_label: string
}

export const TIER_META: Record<ManufacturerTier, {
  icon: string
  label: string
  color: string      // badge classes
  dot: string        // dot color
}> = {
  trusted: {
    icon: '🛡',
    label: 'Trusted manufacturer',
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  standard: {
    icon: '✓',
    label: 'Standard',
    color: 'text-gray-600 bg-gray-50 border-gray-200',
    dot: 'bg-gray-400',
  },
  unverified: {
    icon: '?',
    label: 'Unverified',
    color: 'text-amber-700 bg-amber-50 border-amber-200',
    dot: 'bg-amber-400',
  },
}

export function getTier(score: number): ManufacturerTier {
  if (score >= 80) return 'trusted'
  if (score >= 50) return 'standard'
  return 'unverified'
}

export function normalizeName(name: string): string {
  return name.toLowerCase().trim()
    // strip common suffixes that vary in DB vs product name
    .replace(/\b(ltd|limited|pvt|private|pharmaceuticals|pharma|laboratories|labs|india)\b\.?/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Build a lookup map from an array of scores keyed by normalized name */
export function buildScoreMap(
  rows: Omit<ManufacturerScore, 'tier' | 'tier_label'>[],
): Map<string, ManufacturerScore> {
  const map = new Map<string, ManufacturerScore>()
  for (const row of rows) {
    const tier = getTier(row.trust_score)
    const scored: ManufacturerScore = {
      ...row,
      tier,
      tier_label: TIER_META[tier].label,
    }
    // Index by exact name_normalized AND by stripped name for fuzzy matching
    map.set(row.name_normalized, scored)
    map.set(normalizeName(row.name_normalized), scored)
  }
  return map
}

/** Look up a manufacturer by brand name (fuzzy) */
export function lookupManufacturer(
  manufacturerName: string,
  scoreMap: Map<string, ManufacturerScore>,
): ManufacturerScore | null {
  const exact = manufacturerName.toLowerCase().trim()
  if (scoreMap.has(exact)) return scoreMap.get(exact)!

  const normalized = normalizeName(exact)
  if (scoreMap.has(normalized)) return scoreMap.get(normalized)!

  // Partial match: check if any known name is a substring of the product's manufacturer
  for (const [key, score] of scoreMap) {
    if (exact.includes(key) || key.includes(exact)) return score
  }

  return null
}
