// ══════════════════════════════════════════════
// Composition Normalization Engine
// ══════════════════════════════════════════════

const SYNONYMS: Record<string, string> = {
  // Paracetamol / Acetaminophen
  'acetaminophen': 'paracetamol',
  'acetaminophen ip': 'paracetamol',
  'paracetamol ip': 'paracetamol',
  'paracetamol bp': 'paracetamol',
  // Amoxicillin
  'amoxicillin trihydrate': 'amoxicillin',
  'amoxycillin': 'amoxicillin',
  // Clavulanic acid
  'potassium clavulanate': 'clavulanic acid',
  'clavulanate potassium': 'clavulanic acid',
  'clavulanate': 'clavulanic acid',
  // Metformin
  'metformin hydrochloride': 'metformin',
  'metformin hcl': 'metformin',
  // Atorvastatin
  'atorvastatin calcium': 'atorvastatin',
  'atorvastatin calcium trihydrate': 'atorvastatin',
  // Pantoprazole
  'pantoprazole sodium': 'pantoprazole',
  'pantoprazole sodium sesquihydrate': 'pantoprazole',
  // Cetirizine
  'cetirizine hydrochloride': 'cetirizine',
  'cetirizine hcl': 'cetirizine',
  // Montelukast
  'montelukast sodium': 'montelukast',
  // Amlodipine
  'amlodipine besylate': 'amlodipine',
  'amlodipine besilate': 'amlodipine',
  'amlodipine maleate': 'amlodipine',
  // Omeprazole
  'omeprazole magnesium': 'omeprazole',
  'omeprazole sodium': 'omeprazole',
  // Ibuprofen
  'ibuprofen lysine': 'ibuprofen',
  'ibuprofen sodium': 'ibuprofen',
  // Diclofenac
  'diclofenac sodium': 'diclofenac',
  'diclofenac potassium': 'diclofenac',
  'diclofenac diethylamine': 'diclofenac',
  // Levocetirizine
  'levocetirizine dihydrochloride': 'levocetirizine',
  'levocetirizine hcl': 'levocetirizine',
  // Rosuvastatin
  'rosuvastatin calcium': 'rosuvastatin',
  // Esomeprazole
  'esomeprazole magnesium': 'esomeprazole',
  'esomeprazole sodium': 'esomeprazole',
  // Rabeprazole
  'rabeprazole sodium': 'rabeprazole',
  // Losartan
  'losartan potassium': 'losartan',
  // Levothyroxine
  'levothyroxine sodium': 'levothyroxine',
  // Azithromycin
  'azithromycin dihydrate': 'azithromycin',
  'azithromycin monohydrate': 'azithromycin',
  // Ciprofloxacin
  'ciprofloxacin hydrochloride': 'ciprofloxacin',
  'ciprofloxacin hcl': 'ciprofloxacin',
  // Doxycycline
  'doxycycline hyclate': 'doxycycline',
  'doxycycline monohydrate': 'doxycycline',
  // Sitagliptin
  'sitagliptin phosphate monohydrate': 'sitagliptin',
  // Lisinopril
  'lisinopril dihydrate': 'lisinopril',
  // Enalapril
  'enalapril maleate': 'enalapril',
  // Domperidone
  'domperidone maleate': 'domperidone',
  // Ondansetron
  'ondansetron hydrochloride': 'ondansetron',
  'ondansetron hcl': 'ondansetron',
  // Sertraline
  'sertraline hydrochloride': 'sertraline',
  'sertraline hcl': 'sertraline',
  // Escitalopram
  'escitalopram oxalate': 'escitalopram',
  // Zinc spelling normalizer
  'zinc sulfate': 'zinc sulphate',
}

const DOSAGE_FORMS = [
  'tablet', 'capsule', 'syrup', 'injection', 'gel', 'cream', 'suspension',
  'drops', 'inhaler', 'spray', 'patch', 'ointment', 'lotion', 'solution',
  'powder', 'granules', 'strips', 'suppository', 'liquid', 'emulsion',
]

const RELEASE_TYPES: Record<string, string> = {
  // Full phrases first (higher specificity — prevents abbreviation false-matches)
  'enteric coated': 'EC',
  'sustained release': 'SR',
  'extended release': 'ER',
  'controlled release': 'CR',
  'modified release': 'MR',
  'delayed release': 'DR',
  // Abbreviations after
  '\\bsr\\b': 'SR',
  '\\ber\\b': 'ER',
  '\\bcr\\b': 'CR',
  '\\bmr\\b': 'MR',
  '\\bxr\\b': 'XR',
  '\\bec\\b': 'EC',
  '\\bdr\\b': 'DR',
  '\\bla\\b': 'LA',
}

export interface ParsedIngredient {
  name: string
  strength: number
  unit: string
}

export interface ParsedComposition {
  ingredients: ParsedIngredient[]
  dosage_form: string
  release_type: string
}

function normalizeIngredientName(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/\b(ip|bp|usp|ep|nf)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  return SYNONYMS[cleaned] ?? cleaned
}

export function parseComposition(text: string): ParsedComposition {
  const lower = text.toLowerCase()

  // Detect dosage form — word-boundary regex prevents substring false matches
  // (e.g. 'gel' inside 'google', 'solution' inside 'dissolution')
  let dosage_form = 'tablet'
  for (const form of DOSAGE_FORMS) {
    if (new RegExp(`\\b${form}\\b`, 'i').test(lower)) { dosage_form = form; break }
  }

  // Detect release type — full phrases checked before abbreviations
  let release_type = 'IR'
  for (const [pattern, value] of Object.entries(RELEASE_TYPES)) {
    if (new RegExp(pattern, 'i').test(lower)) { release_type = value; break }
  }

  // Split on + for combination drugs
  const parts = text.split(/\s*\+\s*/)

  const ingredients: ParsedIngredient[] = parts
    .map(part => {
      // Strip parenthetical content so that "(as trihydrate)", "(as Potassium Salt)",
      // "(equiv. to ...)" etc. don't break the name capture group.
      // Replace with a space (not empty string) to avoid jamming adjacent words.
      const cleanedPart = part.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()

      // Digits allowed in name group to handle "Vitamin B12", "Coenzyme Q10", etc.
      const match = cleanedPart.match(
        /([a-zA-Z][a-zA-Z0-9\s\-]+?)\s+(\d+(?:\.\d+)?)\s*(mg|ml|mcg|g|iu|%)\b/i
      )
      if (!match) return null

      const rawUnit = match[3].toLowerCase()
      const rawStrength = parseFloat(match[2])
      // Normalize g → mg so "Metformin 1g" and "Metformin 1000mg" produce the same key
      const strength = rawUnit === 'g' ? rawStrength * 1000 : rawStrength
      const unit = rawUnit === 'g' ? 'mg' : rawUnit

      return {
        name: normalizeIngredientName(match[1].trim()),
        strength,
        unit,
      }
    })
    .filter((x): x is ParsedIngredient => x !== null)

  return { ingredients, dosage_form, release_type }
}

export function generateCanonicalKey(parsed: ParsedComposition): string {
  const ingredientPart = parsed.ingredients
    .map(i => `${i.name}|${i.strength}${i.unit}`)
    .sort()
    .join('+')
  return `${ingredientPart}|${parsed.dosage_form}|${parsed.release_type}`
}
