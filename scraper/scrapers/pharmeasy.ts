import { Page } from 'playwright'
import { ScrapedProduct } from '../types'

// PharmEasy - uses typeahead API for product slugs, then fetches detail pages
export async function scrapePharmeasy(page: Page, query: string): Promise<ScrapedProduct[]> {
  const results: ScrapedProduct[] = []
  let typeaheadData: any = null

  page.on('response', async resp => {
    if (resp.url().includes('searchTypeAhead') && !typeaheadData) {
      try { typeaheadData = JSON.parse(await resp.text()) } catch {}
    }
  })

  try {
    await page.goto(`https://pharmeasy.in/search/all?name=${encodeURIComponent(query)}`, {
      waitUntil: 'domcontentloaded', timeout: 20000
    })
    await page.waitForTimeout(3000)

    // Get medicine products from typeahead (entityType 0 = medicine)
    const medicines = (typeaheadData?.data?.products || [])
      .filter((p: any) => p.entityType === 0 || p.entityType === 12)
      .slice(0, 15)

    for (const m of medicines) {
      if (!m.name || !m.slug) continue
      // Visit product page for price details
      const prodPage = await page.context().newPage()
      let prodData: any = null

      prodPage.on('response', async resp => {
        if (resp.url().includes('/api/product/getProductById') || resp.url().includes('/api/medicine/')) {
          try { prodData = JSON.parse(await resp.text()) } catch {}
        }
      })

      try {
        await prodPage.goto(`https://pharmeasy.in/online-pharmacy/${m.slug}`, {
          waitUntil: 'domcontentloaded', timeout: 15000
        })
        await prodPage.waitForTimeout(2000)

        // Try to get price from DOM
        const details = await prodPage.evaluate(() => {
          const mrpEl = document.querySelector('[class*="mrp"], [class*="MRP"], [class*="price"]')
          const nameEl = document.querySelector('h1, [class*="ProductTitle"]')
          const mfrEl = document.querySelector('[class*="manufacturer"], [class*="Manufacturer"]')
          const packEl = document.querySelector('[class*="packSize"], [class*="pack-size"]')
          return {
            mrp: mrpEl?.textContent?.replace(/[^0-9.]/g, '') || '',
            name: nameEl?.textContent?.trim() || '',
            mfr: mfrEl?.textContent?.trim().replace(/^Manufacturer:\s*/i, '') || '',
            pack: packEl?.textContent?.trim() || '',
          }
        })

        const mrp = parseFloat(details.mrp)
        if (mrp && (details.name || m.name)) {
          const brandName = details.name || m.name
          const packMatch = details.pack.match(/(\d+)\s*(tablet|capsule|strip|ml)/i)
          const unit_per_pack = packMatch ? parseInt(packMatch[1]) : 10
          const strengthMatch = brandName.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|iu|ml|%)/i)
          const composition = strengthMatch
            ? `${query} ${strengthMatch[1]}${strengthMatch[2].toLowerCase()}`
            : query

          results.push({
            brand_name: brandName,
            manufacturer: details.mfr || 'Various',
            composition_text_raw: composition,
            dosage_form: /capsule/i.test(brandName) ? 'capsule' : /syrup/i.test(brandName) ? 'syrup' : 'tablet',
            unit_per_pack,
            mrp,
            is_generic: false,
            is_jan_aushadhi: false,
            source: 'pharmeasy',
          })
        }
      } catch {}
      await prodPage.close()
    }
  } catch (e) {
    console.error('  PharmEasy error:', (e as Error).message)
  }

  return results
}
