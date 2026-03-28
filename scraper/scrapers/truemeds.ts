import { Page } from 'playwright'
import { ScrapedProduct } from '../types'

// Truemeds - uses session token + backend API
export async function scrapeTruemeds(page: Page, query: string): Promise<ScrapedProduct[]> {
  const results: ScrapedProduct[] = []
  let sessionToken = ''
  let searchData: any = null

  page.on('response', async resp => {
    if (resp.url().includes('getSessionToken') && !sessionToken) {
      try { sessionToken = (await resp.text()).replace(/"/g, '').trim() } catch {}
    }
    if (resp.url().includes('searchProducts') || resp.url().includes('fetchProductBasicDetails')) {
      try { searchData = JSON.parse(await resp.text()) } catch {}
    }
  })

  try {
    await page.goto(`https://www.truemeds.in/search?searchQuery=${encodeURIComponent(query)}`, {
      waitUntil: 'domcontentloaded', timeout: 25000
    })
    await page.waitForTimeout(4000)

    // If we got a session token, try the API directly
    if (sessionToken && !searchData) {
      searchData = await page.evaluate(async ({ q, token }: { q: string, token: string }) => {
        const r = await fetch(`https://nal.tmmumbai.in/ProductService/searchProducts?searchString=${encodeURIComponent(q)}&pageNo=0&pageSize=20&sessionToken=${token}&isApp=false`, {
          headers: { 'Accept': 'application/json' }
        })
        return r.json()
      }, { q: query, token: sessionToken }).catch(() => null)
    }

    // Also try DOM scraping
    const domProducts = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[class*="ProductCard"], [class*="medicine-card"], [class*="product-item"]'))
      return cards.slice(0, 15).map(card => ({
        name: (card.querySelector('h3, [class*="name"], [class*="title"]')?.textContent || '').trim(),
        mrp: (card.querySelector('[class*="mrp"], [class*="price"]')?.textContent?.replace(/[^0-9.]/g, '') || '0'),
        pack: (card.querySelector('[class*="pack"], [class*="quantity"]')?.textContent || '').trim(),
        mfr: (card.querySelector('[class*="mfr"], [class*="manufacturer"]')?.textContent || '').trim(),
      }))
    })

    // Try API data first
    if (searchData?.responseData) {
      for (const p of (searchData.responseData || [])) {
        const mrp = parseFloat(p.mrp || p.price || '0')
        if (!mrp || !p.medicineName) continue
        const strengthMatch = p.medicineName.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|iu|ml|%)/i)
        const composition = p.composition || (strengthMatch ? `${query} ${strengthMatch[1]}${strengthMatch[2]}` : query)

        results.push({
          brand_name: p.medicineName,
          manufacturer: p.manufacturer || 'Various',
          composition_text_raw: composition,
          dosage_form: p.form || (/capsule/i.test(p.medicineName) ? 'capsule' : 'tablet'),
          unit_per_pack: p.packSize || 10,
          mrp,
          is_generic: p.isGeneric || false,
          is_jan_aushadhi: false,
          source: 'truemeds',
        })
      }
    }

    // Fall back to DOM
    if (results.length === 0) {
      for (const p of domProducts) {
        const mrp = parseFloat(p.mrp)
        if (!mrp || !p.name || p.name.length < 3) continue
        const strengthMatch = p.name.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|iu|ml|%)/i)
        const composition = strengthMatch ? `${query} ${strengthMatch[1]}${strengthMatch[2]}` : query
        results.push({
          brand_name: p.name,
          manufacturer: p.mfr || 'Various',
          composition_text_raw: composition,
          dosage_form: /capsule/i.test(p.name) ? 'capsule' : /syrup/i.test(p.name) ? 'syrup' : 'tablet',
          unit_per_pack: 10,
          mrp,
          is_generic: false,
          is_jan_aushadhi: false,
          source: 'truemeds',
        })
      }
    }
  } catch (e) {
    console.error('  Truemeds error:', (e as Error).message)
  }

  return results
}
