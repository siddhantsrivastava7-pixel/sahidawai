import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import { scrape1mg } from './scrapers/onemg'
import { scrapeNetmeds } from './scrapers/netmeds'
import { scrapePharmeasy } from './scrapers/pharmeasy'
import { scrapeApollo } from './scrapers/apollo'
import { scrapeTruemeds } from './scrapers/truemeds'
import { scrapeMedplus } from './scrapers/medplus'
import { deduplicateProducts, buildCanonicalKey, inferDosageForm } from './normalizer'
import { MEDICINE_QUERIES } from './medicines'
import { ScrapedProduct } from './types'

const OUTPUT_FILE = path.join(__dirname, 'output.json')
const DELAY_BETWEEN_QUERIES = 2000   // ms between medicine queries
const DELAY_BETWEEN_SITES = 1500     // ms between sites

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  // Allow passing specific queries via CLI: node scrape.js "Paracetamol" "Ibuprofen"
  const queries = process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : MEDICINE_QUERIES

  console.log(`Scraping ${queries.length} medicines from 6 sites...`)

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-IN',
    extraHTTPHeaders: { 'Accept-Language': 'en-IN,en;q=0.9' },
  })

  // Load existing output if resuming
  let allProducts: ScrapedProduct[] = []
  if (fs.existsSync(OUTPUT_FILE)) {
    allProducts = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'))
    console.log(`Resuming — ${allProducts.length} products already scraped`)
  }

  const scrapers = [
    { name: '1mg',    fn: scrape1mg },
    { name: 'Apollo', fn: scrapeApollo },
    // Netmeds, PharmEasy, Truemeds, MedPlus block headless browsers
  ]

  for (let qi = 0; qi < queries.length; qi++) {
    const query = queries[qi]
    console.log(`\n[${qi + 1}/${queries.length}] Searching: ${query}`)

    for (const scraper of scrapers) {
      const page = await context.newPage()
      try {
        const results = await scraper.fn(page, query)
        // Normalize
        const normalized = results.map(p => ({
          ...p,
          dosage_form: inferDosageForm(p.brand_name, p.dosage_form),
          canonical_key: buildCanonicalKey(p.composition_text_raw || p.brand_name, p.dosage_form),
        }))
        allProducts.push(...normalized)
        console.log(`  ${scraper.name}: ${results.length} products`)
      } catch (e) {
        console.error(`  ${scraper.name}: failed — ${(e as Error).message}`)
      } finally {
        await page.close()
        await delay(DELAY_BETWEEN_SITES)
      }
    }

    // Save after each medicine query (allows resuming)
    const deduped = deduplicateProducts(allProducts)
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(deduped, null, 2))
    console.log(`  Saved ${deduped.length} unique products so far`)

    if (qi < queries.length - 1) await delay(DELAY_BETWEEN_QUERIES)
  }

  await browser.close()

  const final = deduplicateProducts(allProducts)
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(final, null, 2))
  console.log(`\nDone! ${final.length} unique products saved to output.json`)
}

main().catch(console.error)
