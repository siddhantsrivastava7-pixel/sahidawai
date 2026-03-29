import { ScrapedProduct } from './types'
import { parseComposition, generateCanonicalKey } from '../lib/composition-engine'

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

// Build canonical key from composition using the composition engine.
// This produces the same format as lib/composition-engine.ts so that
// scraper-inserted products are found as alternatives of DB products and vice versa.
export function buildCanonicalKey(composition: string, dosageForm: string): string {
  try {
    const parsed = parseComposition(composition)
    if (parsed.ingredients.length === 0) throw new Error('no ingredients parsed')
    // composition-engine infers dosage_form from the text; override with the
    // explicit value we have from the scraper if it's more specific.
    if (dosageForm && dosageForm !== 'tablet') {
      parsed.dosage_form = dosageForm.toLowerCase()
    }
    return generateCanonicalKey(parsed)
  } catch {
    // Fallback: slug the raw composition (avoids collisions better than the old
    // strength-stripping approach, but still not ideal — this path should be rare).
    return composition
      .toLowerCase()
      .replace(/[^a-z0-9+]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 120)
  }
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
