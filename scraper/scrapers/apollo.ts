import { Page } from 'playwright'
import { ScrapedProduct } from '../types'

// Apollo intercepts: https://search.apollo247.com/v4/fullSearch
export async function scrapeApollo(page: Page, query: string): Promise<ScrapedProduct[]> {
  const results: ScrapedProduct[] = []
  const datasets: any[] = []

  page.on('response', async resp => {
    if (resp.url().includes('search.apollo247.com/v4/fullSearch')) {
      try { datasets.push(JSON.parse(await resp.text())) } catch {}
    }
  })

  try {
    await page.goto(`https://www.apollopharmacy.in/search-medicines/${encodeURIComponent(query)}`, {
      waitUntil: 'networkidle', timeout: 25000
    })
    await page.waitForTimeout(2000)

    for (const apiData of datasets) {
      const products = apiData?.data?.productDetails?.products || []
      for (const p of products) {
        const mrp = p.price
        if (!mrp || !p.name) continue

        // Parse unit_per_pack from unitSize: "10 Tablet", "15 Strips"
        const unitMatch = (p.unitSize || '').match(/^(\d+)/)
        const unit_per_pack = unitMatch ? parseInt(unitMatch[1]) : 10

        const dosage_form = /capsule/i.test(p.name + p.unitSize) ? 'capsule'
          : /syrup|suspension|drops/i.test(p.name + p.unitSize) ? 'syrup'
          : /injection|vial/i.test(p.name + p.unitSize) ? 'injection'
          : /cream|gel|ointment/i.test(p.name + p.unitSize) ? 'cream'
          : /inhaler|rotacap/i.test(p.name + p.unitSize) ? 'inhaler'
          : 'tablet'

        // tags[0] is usually "Ingredient-StrengthMg" e.g. "Paracetamol-650Mg"
        const compTag: string = (p.tags || [])[0] || ''
        const composition = compTag
          ? compTag.replace(/-(\d)/g, ' $1').replace(/Mg$/i, 'mg').replace(/Mcg$/i, 'mcg')
          : query

        results.push({
          brand_name: p.name.replace(/\s*\d+'s?\s*$/i, '').trim(), // strip trailing "10's"
          manufacturer: 'Various',
          composition_text_raw: composition,
          dosage_form,
          unit_per_pack,
          mrp,
          is_generic: p.merchandisingText === 'Generic Alternate',
          is_jan_aushadhi: false,
          source: 'apollo',
          source_url: `https://www.apollopharmacy.in/otc/${p.urlKey}`,
        })
      }
    }
  } catch (e) {
    console.error('  Apollo error:', (e as Error).message)
  }

  return results
}
