import { Page } from 'playwright'
import { ScrapedProduct } from '../types'

// 1mg intercepts its own API: /pwa-dweb-api/api/v4/search/all
export async function scrape1mg(page: Page, query: string): Promise<ScrapedProduct[]> {
  const results: ScrapedProduct[] = []
  let apiData: any = null

  page.on('response', async resp => {
    if (resp.url().includes('pwa-dweb-api') && resp.url().includes('search') && !apiData) {
      try { apiData = JSON.parse(await resp.text()) } catch {}
    }
  })

  try {
    await page.goto(`https://www.1mg.com/search/all?name=${encodeURIComponent(query)}`, {
      waitUntil: 'domcontentloaded', timeout: 20000
    })
    await page.waitForTimeout(3000)

    const drugs = (apiData?.data?.search_results || []).filter((r: any) => r.type === 'drug')

    for (const d of drugs) {
      const mrpStr: string = d.prices?.mrp || ''
      const mrp = parseFloat(mrpStr.replace(/[^0-9.]/g, ''))
      if (!mrp || !d.name) continue

      const label: string = d.label || '' // "strip of 15 tablets"
      const packMatch = label.match(/(\d+)\s*(tablet|capsule|strip|ml|g)\b/i)
      const unit_per_pack = packMatch ? parseInt(packMatch[1]) : 10
      const dosage_form = /capsule/i.test(label + d.name) ? 'capsule'
        : /syrup|suspension|drops/i.test(label + d.name) ? 'syrup'
        : /injection|vial/i.test(label + d.name) ? 'injection'
        : /cream|gel|ointment/i.test(label + d.name) ? 'cream'
        : /inhaler|rotacap/i.test(label + d.name) ? 'inhaler'
        : 'tablet'

      // Infer composition: search query + strength from product name
      const strengthMatch = d.name.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|iu|ml|%)/i)
      const composition = strengthMatch
        ? `${query} ${strengthMatch[1]}${strengthMatch[2].toLowerCase()}`
        : query

      results.push({
        brand_name: d.name.replace(/\s*\(.*?\)/g, '').trim(),
        manufacturer: 'Various',
        composition_text_raw: composition,
        dosage_form,
        unit_per_pack,
        mrp,
        is_generic: /generic/i.test(d.name),
        is_jan_aushadhi: false,
        source: '1mg',
        source_url: `https://www.1mg.com${d.url}`,
      })
    }
  } catch (e) {
    console.error('  1mg error:', (e as Error).message)
  }

  return results
}
