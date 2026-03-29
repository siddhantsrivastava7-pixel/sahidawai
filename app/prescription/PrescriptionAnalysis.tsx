'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PrescriptionAnalysis, PrescriptionItem } from '@/app/api/prescription/route'
import { OcrExtractResponse, OcrCandidate } from '@/app/api/ocr-extract/route'
import PrescriptionReview, { ConfirmedMedicine, CorrectionRecord } from '@/components/PrescriptionReview'

// ── Savings hero ─────────────────────────────────────────────────────────────

function SavingsHero({ analysis }: { analysis: PrescriptionAnalysis }) {
  const { total_savings, total_current_cost, total_cheapest_cost, conditions } = analysis

  const hasSavings = total_savings > 1
  const savingsPct = total_current_cost > 0 ? Math.round((total_savings / total_current_cost) * 100) : 0

  return (
    <div className="space-y-3">
      {conditions.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
          {conditions.map(c => (
            <span key={c.condition} className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border whitespace-nowrap ${
              c.chronic ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-gray-50 border-gray-100 text-gray-600'
            }`}>
              {c.emoji} {c.condition}
            </span>
          ))}
        </div>
      )}

      {hasSavings ? (
        <div className="bg-gray-900 rounded-2xl overflow-hidden">
          <div className="px-5 pt-5 pb-4">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">Total you could save</p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-white text-5xl font-black tracking-tight leading-none">₹{total_savings.toFixed(0)}</p>
                <p className="text-gray-400 text-sm mt-2">on this prescription</p>
              </div>
              <div className="text-right">
                <p className="text-emerald-400 text-4xl font-black tracking-tighter leading-none">{savingsPct}%</p>
                <p className="text-gray-500 text-xs mt-1">cheaper</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-800 px-5 py-3">
            <p className="text-sm">
              <span className="text-gray-500 line-through">₹{total_current_cost.toFixed(0)}</span>
              <span className="text-white font-bold ml-2">→ ₹{total_cheapest_cost.toFixed(0)}</span>
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0 text-xl">✅</div>
          <div>
            <p className="font-bold text-emerald-800 text-sm">Already on best options</p>
            <p className="text-emerald-600 text-xs mt-0.5">No cheaper safe alternatives found.</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Medicine card ─────────────────────────────────────────────────────────────

function MedicineCard({ item }: { item: PrescriptionItem }) {
  const router = useRouter()

  const cheapestAlt = item.alternatives?.find(a => a.verdict === 'safe' && a.savings_per_unit > 0)
    ?? item.alternatives?.find(a => a.verdict === 'check_pharmacist' && a.savings_per_unit > 0)

  const hasSavings = (item.course_savings ?? 0) > 0.5
  const displaySavings = item.course_savings
  const costLabel = 'on this course'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4">
        {/* Name + dosing */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-base leading-tight">{item.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{item.frequency_label} · {item.duration_days} day{item.duration_days !== 1 ? 's' : ''}</p>
          </div>
          {item.is_chronic && (
            <span className="shrink-0 text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full font-bold uppercase">Chronic</span>
          )}
        </div>

        {/* Not in database */}
        {!item.found && (
          <button
            onClick={() => router.push(`/search?q=${encodeURIComponent(item.name)}`)}
            className="w-full text-sm text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 rounded-xl py-3 active:bg-emerald-100"
          >
            Search manually →
          </button>
        )}

        {/* Has a cheaper option */}
        {item.found && hasSavings && cheapestAlt && (
          <button
            onClick={() => router.push(`/search?q=${encodeURIComponent(item.name)}`)}
            className="w-full flex items-center justify-between bg-emerald-600 rounded-xl px-4 py-3.5 text-left active:bg-emerald-700 transition-colors"
          >
            <div className="flex-1 min-w-0 pr-3">
              <p className="text-emerald-200 text-[10px] font-bold uppercase tracking-wide mb-0.5">Switch to</p>
              <p className="text-white font-bold text-sm leading-tight truncate">{cheapestAlt.brand_name}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-white text-lg font-black leading-none">Save ₹{displaySavings?.toFixed(0)}</p>
              <p className="text-emerald-300 text-[10px] mt-0.5">{costLabel}</p>
            </div>
          </button>
        )}

        {/* Already cheapest */}
        {item.found && !hasSavings && (
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
            <span className="text-emerald-500 text-sm">✓</span>
            <p className="text-sm text-gray-500 font-medium">Already the cheapest option</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Status = 'idle' | 'extracting' | 'reviewing' | 'analysing' | 'done' | 'error'

export default function PrescriptionAnalysisPage() {
  const [status, setStatus] = useState<Status>('idle')
  const [candidates, setCandidates] = useState<OcrCandidate[]>([])
  const [sessionId, setSessionId] = useState('')
  const [analysis, setAnalysis] = useState<PrescriptionAnalysis | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setStatus('idle')
    setCandidates([])
    setAnalysis(null)
    setErrorMsg('')
    if (inputRef.current) inputRef.current.value = ''
  }

  // Step 1: Upload → OCR extract
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setStatus('extracting')
    setErrorMsg('')

    const formData = new FormData()
    formData.append('image', file)

    try {
      const res = await fetch('/api/ocr-extract', { method: 'POST', body: formData })
      const data: OcrExtractResponse = await res.json()
      if (!res.ok || !data.candidates?.length) {
        setErrorMsg((data as any).error ?? 'Could not read any medicines from this photo.')
        setStatus('error')
        return
      }
      setCandidates(data.candidates)
      setSessionId(data.session_id)
      setStatus('reviewing')
    } catch {
      setErrorMsg('Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  // Step 2: User confirms → run analysis
  const handleConfirm = async (medicines: ConfirmedMedicine[], corrections: CorrectionRecord[]) => {
    setStatus('analysing')

    // Store corrections fire-and-forget
    void fetch('/api/ocr-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, corrections }),
    })

    try {
      const res = await fetch('/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicines, session_id: sessionId }),
      })
      const data = await res.json()
      if (!res.ok || !data.items) {
        setErrorMsg(data.error ?? 'Analysis failed.')
        setStatus('error')
        return
      }
      setAnalysis(data)
      setStatus('done')
    } catch {
      setErrorMsg('Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pt-8 pb-16">

        {/* Header */}
        {(status === 'idle' || status === 'extracting') && (
          <div className="mb-8">
            <p className="text-[10px] font-bold tracking-[0.2em] text-emerald-600 uppercase mb-2">Prescription scan</p>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Find cheaper medicines</h1>
            <p className="text-gray-400 text-sm mt-1.5">Upload your prescription — we find savings instantly.</p>
          </div>
        )}

        <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />

        {/* Idle */}
        {status === 'idle' && (
          <div className="space-y-4">
            <button
              onClick={() => inputRef.current?.click()}
              className="w-full bg-white border-2 border-dashed border-gray-200 rounded-2xl py-16 flex flex-col items-center gap-4 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all active:scale-[0.99]"
            >
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100">
                <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="text-center px-6">
                <p className="text-base font-bold text-gray-800">Take or upload a photo</p>
                <p className="text-sm text-gray-400 mt-1">JPG, PNG, WebP · Max 10 MB</p>
              </div>
            </button>
            <div className="grid grid-cols-3 gap-3">
              {[{ icon: '💰', label: 'Monthly savings' }, { icon: '🛡', label: 'Safety check' }, { icon: '🏥', label: 'Condition hints' }].map(f => (
                <div key={f.label} className="bg-white border border-gray-100 rounded-xl p-4 text-center shadow-sm">
                  <p className="text-2xl mb-2">{f.icon}</p>
                  <p className="text-[11px] font-semibold text-gray-600 leading-tight">{f.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Extracting */}
        {status === 'extracting' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center py-12 gap-5">
              <div className="flex items-center gap-2">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-3 h-3 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-gray-800">Reading prescription…</p>
                <p className="text-sm text-gray-400 mt-1">Extracting medicines · Matching to database</p>
              </div>
            </div>
            {[1, 2, 3].map(i => <div key={i} className="h-28 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
          </div>
        )}

        {/* Review */}
        {status === 'reviewing' && candidates.length > 0 && (
          <PrescriptionReview
            candidates={candidates}
            sessionId={sessionId}
            onConfirm={handleConfirm}
          />
        )}

        {/* Analysing */}
        {status === 'analysing' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center py-12 gap-5">
              <div className="flex items-center gap-2">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-3 h-3 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-gray-800">Finding alternatives…</p>
                <p className="text-sm text-gray-400 mt-1">Calculating savings · Checking safety</p>
              </div>
            </div>
            {[1, 2, 3].map(i => <div key={i} className="h-28 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5 text-3xl">📋</div>
            <p className="text-gray-900 font-bold text-base mb-1">{errorMsg}</p>
            <p className="text-gray-400 text-sm mb-7 max-w-xs mx-auto">Try a clearer photo with good lighting.</p>
            <button onClick={reset} className="bg-emerald-600 text-white text-sm font-bold px-7 py-3.5 rounded-xl active:bg-emerald-700">
              Try again
            </button>
          </div>
        )}

        {/* Done */}
        {status === 'done' && analysis && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Your prescription</h2>
                <p className="text-sm text-gray-400 mt-0.5">{analysis.items.length} medicine{analysis.items.length !== 1 ? 's' : ''} found</p>
              </div>
              <button onClick={reset} className="text-sm text-gray-500 font-semibold bg-gray-100 px-3.5 py-2 rounded-xl active:bg-gray-200">
                ↺ New scan
              </button>
            </div>

            <SavingsHero analysis={analysis} />
            <div className="space-y-3">
              {analysis.items.map((item, i) => (
                <MedicineCard key={i} item={item} />
              ))}
            </div>

            <p className="text-xs text-gray-400 leading-relaxed pt-1 border-t border-gray-100">
              Always switch medicines under pharmacist or physician supervision.
              Monthly costs estimated at 30 days × prescribed daily dose.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
