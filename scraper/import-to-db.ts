import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { ScrapedProduct } from './types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const INPUT_FILE = path.join(__dirname, 'output.json')
const BATCH_SIZE = 50

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

interface ProductWithKey extends ScrapedProduct {
  canonical_key: string
}

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error('output.json not found — run scrape.ts first')
    process.exit(1)
  }

  const products: ProductWithKey[] = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'))
  console.log(`Importing ${products.length} products into Supabase...`)

  let inserted = 0
  let skipped = 0

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE)

    for (const p of batch) {
      try {
        // Upsert composition
        const { data: comp, error: compErr } = await supabase
          .from('compositions')
          .upsert({
            canonical_key: p.canonical_key,
            dosage_form: p.dosage_form,
            release_type: 'IR',
          }, { onConflict: 'canonical_key' })
          .select('id')
          .single()

        if (compErr) {
          console.error(`  Composition error for ${p.brand_name}:`, compErr.message)
          skipped++
          continue
        }

        // Insert product (skip if same brand+mrp already exists)
        const { data: prod, error: prodErr } = await supabase
          .from('products')
          .upsert({
            brand_name: p.brand_name,
            manufacturer: p.manufacturer,
            composition_text_raw: p.composition_text_raw,
            dosage_form: p.dosage_form,
            release_type: 'IR',
            unit_per_pack: p.unit_per_pack,
            mrp: p.mrp,
            is_generic: p.is_generic,
            is_jan_aushadhi: p.is_jan_aushadhi,
            cdsco_approved: false,
            composition_id: comp.id,
            canonical_key: p.canonical_key,
            source: p.source,
            is_active: true,
          }, { onConflict: 'brand_name,mrp' })
          .select('id')
          .single()

        if (prodErr) {
          // brand_name,mrp conflict = already exists, skip
          if (prodErr.code === '23505') { skipped++; continue }
          console.error(`  Product error for ${p.brand_name}:`, prodErr.message)
          skipped++
          continue
        }

        inserted++
        if (inserted % 50 === 0) {
          console.log(`  ${inserted} inserted, ${skipped} skipped...`)
        }
      } catch (e) {
        console.error(`  Unexpected error for ${p.brand_name}:`, (e as Error).message)
        skipped++
      }
    }
  }

  console.log(`\nDone! ${inserted} products inserted, ${skipped} skipped.`)
}

main().catch(console.error)
