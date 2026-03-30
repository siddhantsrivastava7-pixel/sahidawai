/**
 * Seed script — proactively populate DB with top Indian medicines.
 * Run: npx tsx scripts/seed-medicines.ts
 *
 * Searches 1mg for each query, inserts all variants found.
 * Skips anything already in DB. Rate-limited to be polite to 1mg.
 */


// ── Top medicines by category ────────────────────────────────────────────────
// Generic/salt names → 1mg returns all brand variants for that salt
const SEED_QUERIES = [
  // Antibiotics
  'Amoxicillin 500mg', 'Amoxicillin 250mg', 'Azithromycin 500mg', 'Azithromycin 250mg',
  'Augmentin 625', 'Augmentin 375', 'Ciprofloxacin 500mg', 'Ciprofloxacin 250mg',
  'Doxycycline 100mg', 'Metronidazole 400mg', 'Metronidazole 200mg',
  'Cefixime 200mg', 'Cefixime 100mg', 'Levofloxacin 500mg', 'Levofloxacin 750mg',
  'Clarithromycin 500mg', 'Cefpodoxime 200mg', 'Nitrofurantoin 100mg',
  'Amoxicillin Cloxacillin 500mg', 'Ofloxacin 200mg',

  // Pain / fever / anti-inflammatory
  'Paracetamol 500mg', 'Paracetamol 650mg', 'Ibuprofen 400mg', 'Ibuprofen 200mg',
  'Diclofenac 50mg', 'Aceclofenac 100mg', 'Nimesulide 100mg', 'Naproxen 500mg',
  'Mefenamic acid 500mg', 'Ketorolac 10mg', 'Etoricoxib 90mg', 'Etoricoxib 60mg',
  'Tramadol 50mg', 'Combiflam tablet', 'Aceclofenac Paracetamol tablet',

  // Gastrointestinal
  'Omeprazole 20mg', 'Omeprazole 40mg', 'Pantoprazole 40mg', 'Pantoprazole 20mg',
  'Rabeprazole 20mg', 'Esomeprazole 40mg', 'Domperidone 10mg', 'Ondansetron 4mg',
  'Ondansetron 8mg', 'Metoclopramide 10mg', 'Ranitidine 150mg', 'Famotidine 20mg',
  'Lactulose syrup', 'Bisacodyl 5mg', 'Loperamide 2mg', 'Dicyclomine 20mg',
  'Pantoprazole Domperidone capsule',

  // Diabetes
  'Metformin 500mg', 'Metformin 850mg', 'Metformin 1000mg', 'Glimepiride 1mg',
  'Glimepiride 2mg', 'Sitagliptin 100mg', 'Sitagliptin Metformin 50 500',
  'Vildagliptin 50mg', 'Dapagliflozin 10mg', 'Empagliflozin 10mg',
  'Teneligliptin 20mg', 'Glibenclamide 5mg', 'Pioglitazone 15mg',

  // Blood pressure / cardiac
  'Amlodipine 5mg', 'Amlodipine 10mg', 'Telmisartan 40mg', 'Telmisartan 80mg',
  'Losartan 50mg', 'Atenolol 50mg', 'Metoprolol 25mg', 'Metoprolol 50mg',
  'Ramipril 5mg', 'Ramipril 2.5mg', 'Enalapril 5mg', 'Olmesartan 20mg',
  'Nebivolol 5mg', 'Bisoprolol 5mg', 'Hydrochlorothiazide 12.5mg',
  'Amlodipine Telmisartan tablet', 'Amlodipine Atenolol tablet',

  // Cholesterol
  'Atorvastatin 10mg', 'Atorvastatin 20mg', 'Atorvastatin 40mg',
  'Rosuvastatin 10mg', 'Rosuvastatin 20mg', 'Rosuvastatin 5mg',
  'Fenofibrate 145mg', 'Ezetimibe 10mg',

  // Thyroid
  'Levothyroxine 25mcg', 'Levothyroxine 50mcg', 'Levothyroxine 75mcg',
  'Levothyroxine 100mcg',

  // Respiratory
  'Montelukast 10mg', 'Montelukast Levocetirizine tablet', 'Cetirizine 10mg',
  'Levocetirizine 5mg', 'Fexofenadine 120mg', 'Fexofenadine 180mg',
  'Loratadine 10mg', 'Chlorpheniramine 4mg', 'Salbutamol 4mg',
  'Theophylline 100mg', 'Budesonide inhaler', 'Levosalbutamol 1mg',

  // Vitamins / supplements
  'Vitamin D3 60000 IU', 'Vitamin D3 1000 IU', 'Vitamin B12 500mcg',
  'Calcium carbonate 500mg', 'Folic acid 5mg', 'Iron folic acid tablet',
  'Zinc sulphate 20mg', 'Multivitamin tablet', 'Methylcobalamin 500mcg',
  'Vitamin C 500mg',

  // CNS / psychiatry
  'Alprazolam 0.25mg', 'Alprazolam 0.5mg', 'Clonazepam 0.5mg', 'Clonazepam 1mg',
  'Escitalopram 10mg', 'Sertraline 50mg', 'Fluoxetine 20mg', 'Amitriptyline 10mg',
  'Pregabalin 75mg', 'Gabapentin 300mg',

  // Skin
  'Clobetasol cream', 'Betamethasone cream', 'Hydrocortisone cream',
  'Clotrimazole cream', 'Terbinafine 250mg', 'Fluconazole 150mg',
  'Miconazole cream',

  // Urinary
  'Tamsulosin 0.4mg', 'Nitrofurantoin 100mg', 'Ofloxacin Ornidazole tablet',
  'Norfloxacin 400mg',

  // Common brands (for when patients ask by brand name)
  'Dolo 650', 'Crocin 500', 'Combiflam', 'Pan D capsule',
  'Limcee tablet', 'Becosules capsule', 'Shelcal tablet',
  'Ecosprin 75mg', 'Ecosprin 150mg', 'Clopidogrel 75mg',
  'Aspirin 75mg', 'Aspirin 150mg',
]

// ── 1mg fetcher ──────────────────────────────────────────────────────────────

const GARBAGE_COMPOSITION = new Set([
  'nausea', 'pain', 'fever', 'cold', 'cough', 'acidity', 'allergy',
  'infection', 'acne', 'breakouts', 'inflammation', 'constipation',
  'diarrhea', 'diarrhoea', 'headache', 'vomiting', 'bloating',
  'bacterial infections', 'bacterial eye infections', 'bipolar disorder',
  'prevention of blood clot', 'blood clot',
])

function isGarbageComposition(composition: string): boolean {
  const lower = composition.toLowerCase().trim()
  if (GARBAGE_COMPOSITION.has(lower)) return true
  if (!/\d/.test(composition)) return true
  return false
}

const PRODUCTION_URL = process.env.SEED_API_URL ?? 'https://mydawai.shop'

const SEED_SECRET = process.env.SEED_SECRET ?? ''

async function discoverViaApp(query: string): Promise<{ found: boolean; inserted?: number; already_in_db?: boolean }> {
  const url = `${PRODUCTION_URL}/api/discover`
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-seed-secret': SEED_SECRET,
        },
        body: JSON.stringify({ query, session_id: 'seed' }),
        signal: AbortSignal.timeout(30000),
      })
      if (res.status === 429) {
        process.stdout.write(` [rate limited, waiting 65s]`)
        await sleep(65000)
        continue
      }
      if (!res.ok) {
        const text = await res.text()
        console.error(`  HTTP ${res.status}: ${text.slice(0, 100)}`)
        return { found: false }
      }
      return await res.json()
    } catch (e: any) {
      console.error(`  Error: ${e.message}`)
      return { found: false }
    }
  }
  return { found: false }
}

// ── Sleep helper ─────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Seeding ${SEED_QUERIES.length} queries via ${PRODUCTION_URL}...\n`)

  let totalFound = 0
  let totalNotFound = 0

  for (let i = 0; i < SEED_QUERIES.length; i++) {
    const query = SEED_QUERIES[i]
    process.stdout.write(`[${i + 1}/${SEED_QUERIES.length}] ${query}... `)

    const result = await discoverViaApp(query)
    if (result.found === false && !result.already_in_db) {
      console.log('not found')
      totalNotFound++
    } else {
      console.log(result.already_in_db ? 'already in db' : `inserted ${result.inserted ?? '?'}`)
      totalFound++
    }

    // 2s gap — the discover endpoint itself hits 1mg, be polite
    await sleep(2000)
  }

  console.log(`\nDone. ${totalFound} found, ${totalNotFound} not found.`)
}

main().catch(console.error)
