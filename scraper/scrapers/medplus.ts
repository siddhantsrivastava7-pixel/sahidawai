import { Page } from 'playwright'
import { ScrapedProduct } from '../types'

// MedPlus - uses internal REST API
export async function scrapeMedplus(page: Page, query: string): Promise<ScrapedProduct[]> {
  const results: ScrapedProduct[] = []
  let apiData: any = null

  page.on('response', async resp => {
    const url = resp.url()
    if ((url.includes('searchMedicines') || url.includes('medplusmart') && url.includes('search')) && !apiData) {
      const ct = resp.headers()['content-type'] || ''
      if (ct.includes('json')) {
        try { apiData = JSON.parse(await resp.text()) } catch {}
      }
    }
  })

  try {
    // MedPlus has a REST API
    const apiResp = await page.evaluate(async (q) => {
      const r = await fetch(`https://www.medplusmart.com/searchMedicinesByGeneric?searchTxt=${encodeURIComponent(q)}&pageNo=0&pageSize=20`, {
        headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
      })
      return r.text()
    }, query).catch(() => '')

    if (apiResp && apiResp.startsWith('{')) {
      apiData = JSON.parse(apiResp)
    }

    if (!apiData) {
      // Navigate to search page and wait
      await page.goto(`https://www.medplusmart.com/searchMedicines`, {
        waitUntil: 'domcontentloaded', timeout: 20000
      })
      await page.waitForTimeout(2000)
      // Type search query
      await page.evaluate((q) => {
        const input = document.querySelector('#searchTxt, input[type="search"], input[placeholder*="search" i]') as HTMLInputElement
        if (input) { input.value = q; input.dispatchEvent(new Event('input', { bubbles: true })); }
      }, query)
      await page.waitForTimeout(3000)
    }

    // If API data found, parse it
    if (apiData) {
      const products = apiData.products || apiData.data || apiData.result || []
      for (const p of (Array.isArray(products) ? products : [])) {
        const mrp = parseFloat(p.mrp || p.price || '0')
        if (!mrp || !p.productName) continue
        const strengthMatch = p.productName.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|iu|ml|%)/i)
        const composition = p.composition || (strengthMatch ? `${query} ${strengthMatch[1]}${strengthMatch[2]}` : query)
        results.push({
          brand_name: p.productName,
          manufacturer: p.manufacturer || p.mfr || 'Various',
          composition_text_raw: composition,
          dosage_form: p.type || (/capsule/i.test(p.productName) ? 'capsule' : 'tablet'),
          unit_per_pack: p.packSize || 10,
          mrp,
          is_generic: false,
          is_jan_aushadhi: false,
          source: 'medplus',
        })
      }
    }
  } catch (e) {
    console.error('  MedPlus error:', (e as Error).message)
  }

  return results
}
