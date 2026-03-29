'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Status = 'idle' | 'loading' | 'done' | 'error'

const MAX_BYTES = 10 * 1024 * 1024

const NOISE_WORDS = new Set([
  'date', 'time', 'dose', 'dosage', 'take', 'once', 'twice', 'thrice',
  'daily', 'weekly', 'after', 'before', 'food', 'meals', 'bedtime',
  'morning', 'night', 'evening', 'tablet', 'tablets', 'capsule', 'capsules',
  'syrup', 'days', 'weeks', 'months', 'refill', 'signature', 'doctor',
  'patient', 'name', 'age', 'sex', 'male', 'female', 'address', 'phone',
  'reg', 'registration', 'licence', 'license', 'hospital', 'clinic',
  'unit', 'units', 'instruction', 'general', 'advice', 'notes', 'nil',
])

// Pattern A: "Name 500mg" or "Name 500 mg" (standard)
const RE_A = /([A-Za-z][A-Za-z0-9\s\-]{2,39}?)\s+(\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?)\s*mg\b/gi
// Pattern B: "Name (500 mg)" or "Name(500mg)" — parenthesized dose
const RE_B = /([A-Za-z][A-Za-z0-9\s\-]{2,39}?)\s*\(\s*(\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?)\s*mg\s*\)/gi
// Pattern C: "BrandName 625 Tablet" — brand name + bare number + tablet/cap keyword
const RE_C = /([A-Z][A-Za-z0-9\-]{2,30}(?:\s+[A-Z][A-Za-z0-9\-]{1,20})?)\s+(\d{2,4})\s+(?:tablet|cap|capsule|syrup|drops|injection)\b/gi

function tryExtract(re: RegExp, text: string, seen: Set<string>, results: string[], unitSuffix: string) {
  re.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    const rawName = match[1].trim().replace(/\s+/g, ' ')
    const strength = match[2]
    if (NOISE_WORDS.has(rawName.toLowerCase())) continue
    if (rawName.split(' ').length > 4) continue // skip sentence fragments
    const key = rawName.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      results.push(`${rawName} ${strength}${unitSuffix}`)
    }
  }
}

function extractMedicines(text: string): string[] {
  const seen = new Set<string>()
  const results: string[] = []
  tryExtract(RE_A, text, seen, results, 'mg')
  tryExtract(RE_B, text, seen, results, 'mg')
  // Pattern C: brand + bare number, no unit — search manually
  RE_C.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = RE_C.exec(text)) !== null) {
    const rawName = match[1].trim()
    const strength = match[2]
    if (NOISE_WORDS.has(rawName.toLowerCase())) continue
    const key = rawName.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      results.push(`${rawName} ${strength}`)
    }
  }
  return results
}

export default function PrescriptionUpload() {
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('')
  const [medicines, setMedicines] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_BYTES) {
      setStatus('error')
      return
    }

    setStatus('loading')
    setProgress(0)
    setStatusText('Loading OCR engine…')
    setMedicines([])

    try {
      // Dynamic import so Tesseract only loads when actually needed
      const { createWorker } = await import('tesseract.js')

      const worker = await createWorker('eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'loading tesseract core' || m.status === 'initializing tesseract') {
            setStatusText('Loading OCR engine…')
            setProgress(Math.round(m.progress * 20))
          } else if (m.status === 'loading language traineddata') {
            setStatusText('Loading language model…')
            setProgress(20 + Math.round(m.progress * 20))
          } else if (m.status === 'recognizing text') {
            setStatusText('Reading prescription…')
            setProgress(40 + Math.round(m.progress * 60))
          }
        },
      })

      const { data } = await worker.recognize(file)
      await worker.terminate()

      const found = extractMedicines(data.text)
      setMedicines(found)
      setStatus(found.length === 0 ? 'error' : 'done')
    } catch {
      setStatus('error')
    }
  }

  const handleReset = () => {
    setStatus('idle')
    setProgress(0)
    setStatusText('')
    setMedicines([])
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="mt-3 flex flex-col items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {status === 'idle' && (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 text-gray-400 text-xs font-medium hover:text-emerald-600 transition-colors border border-dashed border-gray-200 hover:border-emerald-300 px-4 py-2 rounded-full hover:bg-emerald-50"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Upload prescription instead
        </button>
      )}

      {status === 'loading' && (
        <div className="flex flex-col items-center gap-2 w-48">
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-medium">
            <svg className="w-3.5 h-3.5 animate-spin shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>{statusText} {progress > 0 ? `${progress}%` : ''}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1">
            <div
              className="bg-emerald-500 h-1 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {status === 'done' && medicines.length > 0 && (
        <div className="flex flex-col items-center gap-2.5 w-full max-w-xl">
          <p className="text-[10px] text-gray-300 font-medium tracking-widest uppercase">Tap a medicine to search</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {medicines.map(name => (
              <button
                key={name}
                onClick={() => router.push(`/search?q=${encodeURIComponent(name)}`)}
                className="bg-white border border-gray-200 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-full hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 transition-all shadow-sm"
              >
                {name}
              </button>
            ))}
          </div>
          <button onClick={handleReset} className="text-gray-300 text-xs hover:text-gray-500 transition-colors mt-0.5">
            ↺ Try another
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center gap-1.5">
          <p className="text-red-400 text-xs">Couldn&apos;t read prescription. Try a clearer photo.</p>
          <button onClick={handleReset} className="text-gray-300 text-xs hover:text-gray-500 transition-colors">
            ↺ Try again
          </button>
        </div>
      )}
    </div>
  )
}
