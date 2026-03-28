import { Page } from 'playwright'
import { ScrapedProduct } from '../types'

// Netmeds - uses DOM scraping (SPA, no interceptable REST API found)
export async function scrapeNetmeds(page: Page, query: string): Promise<ScrapedProduct[]> {
  const results: ScrapedProduct[] = []

  try {
    await page.goto(`https://www.netmeds.com/catalogsearch/result?q=${encodeURIComponent(query)}`, {
      waitUntil: 'domcontentloaded', timeout: 20000
    })
    // Wait for JS to render products
    await page.waitForSelector('.cat-item, .product-list-item, [class*="product"]', { timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(2000)

    const products = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.cat-item, .ais-InfiniteHits-item, .product-item'))
      return cards.slice(0, 15).map(card => ({
        name: (card.querySelector('.clsgetname, h3, [class*="title"]')?.textContent || '').trim(),
        mfr: (card.querySelector('.mfr-name, [class*="mfr"], [class*="vendor"]')?.textContent || '').trim(),
        mrp: (card.querySelector('.price-box .regular-price, .final-price, [class*="price"]')?.textContent?.replace(/[^0-9.]/g, '') || '0'),
        pack: (card.querySelector('.pack-size, [class*="pack"]')?.textContent || '').trim(),
      }))
    })

    for (const p of products) {
      const mrp = parseFloat(p.mrp)
      if (!mrp || !p.name || p.name.length < 3) continue
      const packMatch = p.pack.match(/(\d+)\s*(tablet|capsule|strip|ml)/i)
      const unit_per_pack = packMatch ? parseInt(packMatch[1]) : 10
      const strengthMatch = p.name.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|iu|ml|%)/i)
      const composition = strengthMatch
        ? `${query} ${strengthMatch[1]}${strengthMatch[2].toLowerCase()}`
        : query

      results.push({
        brand_name: p.name,
        manufacturer: p.mfr || 'Various',
        composition_text_raw: composition,
        dosage_form: /capsule/i.test(p.name + p.pack) ? 'capsule' : /syrup/i.test(p.name + p.pack) ? 'syrup' : 'tablet',
        unit_per_pack,
        mrp,
        is_generic: false,
        is_jan_aushadhi: false,
        source: 'netmeds',
      })
    }
  } catch (e) {
    console.error('  Netmeds error:', (e as Error).message)
  }

  return results
}
