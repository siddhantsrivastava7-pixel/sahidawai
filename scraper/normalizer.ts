import { ScrapedProduct } from './types'

// Deduplicate by brand_name + mrp + source, keep the most data-rich version
export function deduplicateProducts(products: ScrapedProduct[]): ScrapedProduct[] {
  const seen = new Map<string, ScrapedProduct>()

  for (const p of products) {
    const key = `${p.brand_name.toLowerCase().trim()}|${p.mrp}|${p.source}`
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, p)
    } else {
      // Prefer whichever has more composition info
      if (p.composition_text_raw.length > existing.composition_text_raw.length) {
        seen.set(key, p)
      }
    }
  }

  return Array.from(seen.values())
}

// Build canonical key from composition
export function buildCanonicalKey(composition: string, dosageForm: string): string {
  // Strip dose amounts to group by ingredient only for canonical key
  const normalized = composition
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/\d+(\.\d+)?\s*(mg|mcg|iu|g|ml|%)/gi, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_+]/g, '')
    .replace(/_+/g, '_')
    .trim()
    .replace(/^_|_$/g, '')

  const form = dosageForm.toLowerCase().replace(/\s+/g, '_')
  return `${normalized}_${form}`
}

// Infer dosage form from brand name if not already set
export function inferDosageForm(brandName: string, currentForm: string): string {
  if (currentForm && currentForm !== 'tablet') return currentForm
  const lower = brandName.toLowerCase()
  if (/\bcap\b|capsule/i.test(lower)) return 'capsule'
  if (/syrup|suspension|drops|liquid/i.test(lower)) return 'syrup'
  if (/injection|inj\b|iv\b/i.test(lower)) return 'injection'
  if (/cream|oint|gel\b|lotion/i.test(lower)) return 'cream'
  if (/inhaler|respule|rotacap/i.test(lower)) return 'inhaler'
  if (/patch/i.test(lower)) return 'patch'
  return currentForm
}
