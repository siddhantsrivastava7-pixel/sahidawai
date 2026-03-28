import { createWorker } from 'tesseract.js'
import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

// Words that commonly appear on prescriptions but are never medicine names
const NOISE_WORDS = new Set([
  'date', 'time', 'dose', 'dosage', 'take', 'once', 'twice', 'thrice',
  'daily', 'weekly', 'after', 'before', 'food', 'meals', 'bedtime',
  'morning', 'night', 'evening', 'tablet', 'tablets', 'capsule', 'capsules',
  'syrup', 'days', 'weeks', 'months', 'refill', 'signature', 'doctor',
  'patient', 'name', 'age', 'sex', 'male', 'female', 'address', 'phone',
  'reg', 'registration', 'licence', 'license', 'hospital', 'clinic',
])

// Match: one or more words (possibly with numbers like B12) followed by a dosage
const DOSAGE_RE = /([A-Za-z][A-Za-z0-9\s\-]{2,39}?)\s+(\d+(?:\.\d+)?)\s*(mg|ml|mcg|g|iu|%)\b/gi

function extractMedicines(text: string): string[] {
  const seen = new Set<string>()
  const results: string[] = []

  let match: RegExpExecArray | null
  // Reset lastIndex since the regex has the /g flag
  DOSAGE_RE.lastIndex = 0
  while ((match = DOSAGE_RE.exec(text)) !== null) {
    const rawName = match[1].trim()
    const strength = match[2]
    const unit = match[3].toLowerCase()

    // Skip if the name is a known noise word
    if (NOISE_WORDS.has(rawName.toLowerCase())) continue

    // Skip names that are entirely lowercase common words (likely sentence fragments)
    if (/^[a-z\s]+$/.test(rawName) && rawName.split(' ').every(w => NOISE_WORDS.has(w))) continue

    const key = rawName.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      results.push(`${rawName} ${strength}${unit}`)
    }
  }

  return results
}

export async function POST(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('image')

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No image file provided' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Unsupported file type. Use JPEG, PNG, WebP, or GIF.' },
      { status: 400 }
    )
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'File too large. Maximum size is 10 MB.' },
      { status: 400 }
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  let rawText: string
  const worker = await createWorker('eng', 1, { logger: () => {} })
  try {
    const { data } = await worker.recognize(buffer)
    rawText = data.text
  } catch (err) {
    console.error('Tesseract error:', err)
    return NextResponse.json({ error: 'OCR failed' }, { status: 500 })
  } finally {
    await worker.terminate()
  }

  const medicines = extractMedicines(rawText)
  return NextResponse.json({ medicines })
}
