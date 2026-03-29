/**
 * Condition inference from medicine combinations.
 * Maps canonical ingredient names → likely condition.
 * Used for disease-pattern data collection (internal) and
 * user-facing "Managing: Diabetes · Hypertension" display.
 */

export interface ConditionHint {
  condition: string
  icd_hint: string    // rough ICD-10 category for internal analytics
  emoji: string
  chronic: boolean    // chronic → monthly cost matters a lot
}

// Each entry: array of ingredient keywords (ANY match → condition detected)
// Order matters: more specific first
const CONDITION_RULES: { keywords: string[]; hint: ConditionHint }[] = [
  {
    keywords: ['metformin', 'glipizide', 'glimepiride', 'sitagliptin', 'vildagliptin',
               'dapagliflozin', 'empagliflozin', 'canagliflozin', 'insulin', 'glibenclamide',
               'pioglitazone', 'teneligliptin', 'saxagliptin'],
    hint: { condition: 'Diabetes', icd_hint: 'E11', emoji: '🩸', chronic: true },
  },
  {
    keywords: ['amlodipine', 'telmisartan', 'losartan', 'ramipril', 'enalapril', 'lisinopril',
               'olmesartan', 'valsartan', 'nifedipine', 'bisoprolol', 'nebivolol', 'atenolol',
               'hydrochlorothiazide', 'indapamide', 'clonidine'],
    hint: { condition: 'Hypertension', icd_hint: 'I10', emoji: '❤️', chronic: true },
  },
  {
    keywords: ['atorvastatin', 'rosuvastatin', 'simvastatin', 'pitavastatin', 'lovastatin',
               'fenofibrate', 'ezetimibe'],
    hint: { condition: 'High Cholesterol', icd_hint: 'E78', emoji: '🫀', chronic: true },
  },
  {
    keywords: ['levothyroxine', 'thyroxine', 'carbimazole', 'propylthiouracil'],
    hint: { condition: 'Thyroid Disorder', icd_hint: 'E03', emoji: '🦋', chronic: true },
  },
  {
    keywords: ['salbutamol', 'budesonide', 'formoterol', 'salmeterol', 'montelukast',
               'theophylline', 'tiotropium', 'ipratropium'],
    hint: { condition: 'Asthma / COPD', icd_hint: 'J45', emoji: '🫁', chronic: true },
  },
  {
    keywords: ['sertraline', 'fluoxetine', 'escitalopram', 'paroxetine', 'venlafaxine',
               'duloxetine', 'mirtazapine', 'bupropion', 'clomipramine'],
    hint: { condition: 'Depression / Anxiety', icd_hint: 'F32', emoji: '🧠', chronic: true },
  },
  {
    keywords: ['phenytoin', 'carbamazepine', 'valproate', 'valproic acid', 'levetiracetam',
               'lamotrigine', 'oxcarbazepine', 'topiramate', 'clonazepam'],
    hint: { condition: 'Epilepsy', icd_hint: 'G40', emoji: '⚡', chronic: true },
  },
  {
    keywords: ['warfarin', 'rivaroxaban', 'apixaban', 'dabigatran', 'clopidogrel', 'aspirin',
               'prasugrel', 'ticagrelor'],
    hint: { condition: 'Blood Clot / Heart', icd_hint: 'I26', emoji: '💊', chronic: true },
  },
  {
    keywords: ['methotrexate', 'hydroxychloroquine', 'sulfasalazine', 'leflunomide',
               'prednisolone', 'methylprednisolone'],
    hint: { condition: 'Arthritis / Autoimmune', icd_hint: 'M06', emoji: '🦴', chronic: true },
  },
  {
    keywords: ['omeprazole', 'pantoprazole', 'esomeprazole', 'rabeprazole', 'lansoprazole',
               'domperidone', 'ondansetron', 'ranitidine'],
    hint: { condition: 'Acidity / GERD', icd_hint: 'K21', emoji: '🫃', chronic: false },
  },
  {
    keywords: ['amoxicillin', 'azithromycin', 'ciprofloxacin', 'doxycycline', 'cefixime',
               'cefpodoxime', 'clarithromycin', 'levofloxacin', 'metronidazole'],
    hint: { condition: 'Infection', icd_hint: 'J06', emoji: '🦠', chronic: false },
  },
  {
    keywords: ['paracetamol', 'ibuprofen', 'diclofenac', 'aceclofenac', 'nimesulide', 'naproxen'],
    hint: { condition: 'Pain / Fever', icd_hint: 'R50', emoji: '🌡️', chronic: false },
  },
  {
    keywords: ['cetirizine', 'levocetirizine', 'fexofenadine', 'loratadine', 'chlorpheniramine'],
    hint: { condition: 'Allergy', icd_hint: 'J30', emoji: '🤧', chronic: false },
  },
  {
    keywords: ['vitamin d', 'calcium', 'vitamin b12', 'folic acid', 'ferrous', 'iron'],
    hint: { condition: 'Nutritional Supplement', icd_hint: 'Z29', emoji: '💊', chronic: true },
  },
]

export function inferConditions(ingredientNames: string[]): ConditionHint[] {
  const lower = ingredientNames.map(n => n.toLowerCase().trim())
  const seen = new Set<string>()
  const results: ConditionHint[] = []

  for (const rule of CONDITION_RULES) {
    if (rule.keywords.some(k => lower.some(n => n.includes(k)))) {
      if (!seen.has(rule.hint.condition)) {
        seen.add(rule.hint.condition)
        results.push(rule.hint)
      }
    }
  }

  return results
}
