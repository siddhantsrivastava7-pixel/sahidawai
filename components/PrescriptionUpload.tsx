'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Status = 'idle' | 'uploading' | 'done' | 'error'

const MAX_BYTES = 10 * 1024 * 1024

export default function PrescriptionUpload() {
  const [status, setStatus] = useState<Status>('idle')
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

    setStatus('uploading')
    setMedicines([])

    const formData = new FormData()
    formData.append('image', file)

    try {
      const res = await fetch('/api/ocr', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok || !Array.isArray(data.medicines)) {
        setStatus('error')
        return
      }

      setMedicines(data.medicines)
      setStatus(data.medicines.length === 0 ? 'error' : 'done')
    } catch {
      setStatus('error')
    }
  }

  const handleReset = () => {
    setStatus('idle')
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

      {status === 'uploading' && (
        <div className="flex items-center gap-2 text-emerald-600 text-xs font-medium">
          <svg className="w-3.5 h-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Reading prescription…
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
