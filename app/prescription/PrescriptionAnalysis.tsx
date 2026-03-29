'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PrescriptionAnalysis, PrescriptionItem } from '@/app/api/prescription/route'
import { SubstitutionWarning } from '@/types'

const WARNING_META: Record<SubstitutionWarning, { label: string; color: string }> = {
  release_type_mismatch:     { label: 'Release type mismatch', color: 'text-red-600 bg-red-50 border-red-100' },
  strength_mismatch:         { label: 'Different strength',    color: 'text-red-600 bg-red-50 border-red-100' },
  narrow_therapeutic_index:  { label: 'NTI drug — ask doctor', color: 'text-amber-700 bg-amber-50 border-amber-100' },
  critical_drug:             { label: 'Critical drug',         color: 'text-amber-700 bg-amber-50 border-amber-100' },
  user_flagged:              { label: 'Flagged by users',      color: 'text-red-600 bg-red-50 border-red-100' },
}

function RiskBadge({ w }: { w: SubstitutionWarning }) {
  const m = WARNING_META[w]
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${m.color}`}>
      ⚠ {m.label}
    </span>
  )
}

function MedicineRow({ item }: { item: PrescriptionItem }) {
  const router = useRouter()
  const cheapestAlt = item.alternatives?.find(a => a.is_safe_substitute && a.savings_per_unit > 0)
    ?? item.alternatives?.find(a => a.savings_per_unit > 0)

  // Collect all warnings across alternatives (to flag the medicine as risky)
  const allWarnings = Array.from(new Set(
    (item.alternatives ?? []).flatMap(a => a.substitution_warnings)
  )) as SubstitutionWarning[]

  const isNti = allWarnings.includes('narrow_therapeutic_index') || allWarnings.includes('critical_drug')
  const hasSavings = (item.course_savings ?? 0) > 0.5

  return (
    <div className={`bg-white rounded-2xl border p-4 sm:p-5 ${isNti ? 'border-amber-100' : hasSavings ? 'border-emerald-100' : 'border-gray-100'}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900 text-sm">{item.name}</p>
            {!item.found && (
              <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-medium">Not in database</span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
            {item.frequency_label} · {item.duration_days} days · {item.tabs_per_course} tablets
          </p>
          {item.found && (
            <p className="text-[11px] text-gray-400 mt-0.5">
              {item.product?.manufacturer}
            </p>
          )}
        </div>

        {/* Course cost */}
        {item.found && item.course_cost !== undefined && (
          <div className="text-right shrink-0">
            <p className="text-base font-bold text-gray-900">₹{item.course_cost.toFixed(0)}</p>
            <p className="text-[10px] text-gray-400 font-medium">for course</p>
          </div>
        )}
      </div>

      {/* Savings + cheapest alt */}
      {item.found && hasSavings && cheapestAlt && (
        <div className="mt-3 flex items-center justify-between bg-emerald-50 rounded-xl px-3 py-2.5 border border-emerald-100">
          <div>
            <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wide mb-0.5">Cheapest alternative</p>
            <p className="text-sm font-bold text-emerald-800">{cheapestAlt.brand_name}</p>
            <p className="text-[10px] text-emerald-600">{cheapestAlt.manufacturer}</p>
          </div>
          <div className="text-right">
            <p className="text-base font-black text-emerald-700">
              Save ₹{(item.course_savings ?? 0).toFixed(0)}
            </p>
            <p className="text-[10px] text-emerald-500">on this course</p>
            <button
              onClick={() => router.push(`/search?q=${encodeURIComponent(item.name)}`)}
              className="mt-1 text-[10px] text-emerald-600 font-semibold hover:underline"
            >
              See all →
            </button>
          </div>
        </div>
      )}

      {/* NTI warning */}
      {isNti && (
        <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-[11px] text-amber-700 font-medium">
          ⚠ This is a critical/NTI drug. Do not switch without your doctor&apos;s guidance.
        </div>
      )}

      {/* Other warnings */}
      {!isNti && allWarnings.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {allWarnings.map(w => <RiskBadge key={w} w={w} />)}
        </div>
      )}

      {/* Not found nudge */}
      {!item.found && (
        <button
          onClick={() => router.push(`/search?q=${encodeURIComponent(item.name)}`)}
          className="mt-3 text-[11px] text-emerald-600 font-semibold hover:underline"
        >
          Search anyway →
        </button>
      )}
    </div>
  )
}

function SavingsSummary({ analysis }: { analysis: PrescriptionAnalysis }) {
  const savingsPct = analysis.total_current_cost > 0
    ? (analysis.total_savings / analysis.total_current_cost * 100).toFixed(0)
    : '0'

  if (analysis.total_savings < 1) return null

  return (
    <div className="relative bg-gradient-to-br from-emerald-700 to-emerald-500 rounded-2xl p-5 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '18px 18px' }}
      />
      <div className="relative">
        <p className="text-emerald-200 text-xs font-semibold uppercase tracking-widest mb-2">
          Total prescription savings
        </p>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-white text-4xl font-black tracking-tight">
              ₹{analysis.total_savings.toFixed(0)}
              <span className="text-lg font-semibold text-emerald-200"> saved</span>
            </p>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <div>
                <p className="text-emerald-300 text-[10px] font-medium uppercase tracking-wide">Currently paying</p>
                <p className="text-white font-bold">₹{analysis.total_current_cost.toFixed(0)}</p>
              </div>
              <div className="text-emerald-400">→</div>
              <div>
                <p className="text-emerald-300 text-[10px] font-medium uppercase tracking-wide">With alternatives</p>
                <p className="text-white font-bold">₹{analysis.total_cheapest_cost.toFixed(0)}</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white text-5xl font-black tracking-tighter leading-none">{savingsPct}%</p>
            <p className="text-emerald-300 text-xs font-medium mt-0.5">cheaper</p>
          </div>
        </div>
      </div>
    </div>
  )
}

type Status = 'idle' | 'loading' | 'done' | 'error'

export default function PrescriptionAnalysisPage() {
  const [status, setStatus] = useState<Status>('idle')
  const [analysis, setAnalysis] = useState<PrescriptionAnalysis | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setStatus('loading')
    setAnalysis(null)
    setErrorMsg('')

    const formData = new FormData()
    formData.append('image', file)

    try {
      const res = await fetch('/api/prescription', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok || !data.items) {
        setErrorMsg(data.error ?? 'Could not read prescription.')
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

  const reset = () => {
    setStatus('idle')
    setAnalysis(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <p className="text-[10px] font-bold tracking-[0.2em] text-emerald-600 uppercase mb-2">Prescription Intelligence</p>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Full Prescription Breakdown</h1>
          <p className="text-gray-400 text-sm mt-1.5">
            Upload your prescription. We analyse every medicine, find cheaper alternatives, and show your total savings.
          </p>
        </div>

        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

        {/* Upload prompt */}
        {status === 'idle' && (
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-14 flex flex-col items-center gap-3 hover:border-emerald-300 hover:bg-emerald-50/40 transition-all group"
          >
            <div className="w-12 h-12 bg-white rounded-xl border border-gray-100 flex items-center justify-center shadow-sm group-hover:border-emerald-200 transition-colors">
              <svg className="w-5 h-5 text-gray-400 group-hover:text-emerald-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-700 group-hover:text-emerald-700">Upload prescription photo</p>
              <p className="text-xs text-gray-400 mt-0.5">JPG, PNG, WebP · Max 10 MB</p>
            </div>
          </button>
        )}

        {/* Loading */}
        {status === 'loading' && (
          <div className="space-y-3">
            <div className="flex flex-col items-center py-10 gap-4">
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-700">Analysing prescription…</p>
                <p className="text-xs text-gray-400 mt-0.5">Reading medicines · Finding alternatives · Calculating savings</p>
              </div>
            </div>
            {/* Skeleton cards */}
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />
            ))}
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="text-center py-14">
            <p className="text-red-500 text-sm font-medium mb-1">{errorMsg}</p>
            <p className="text-gray-400 text-xs mb-5">Try a clearer photo with good lighting.</p>
            <button onClick={reset} className="bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors">
              Try again
            </button>
          </div>
        )}

        {/* Results */}
        {status === 'done' && analysis && (
          <div className="space-y-3">
            <SavingsSummary analysis={analysis} />

            <div className="flex items-center justify-between py-1">
              <p className="text-[10px] font-bold tracking-[0.2em] text-gray-400 uppercase">
                {analysis.items.length} Medicine{analysis.items.length !== 1 ? 's' : ''} Found
              </p>
              <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 transition-colors font-medium">
                ↺ Upload another
              </button>
            </div>

            {analysis.items.map((item, i) => (
              <MedicineRow key={i} item={item} />
            ))}

            <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs text-gray-400 leading-relaxed mt-2">
              <strong className="text-gray-500">Disclaimer:</strong> Always switch medicines under pharmacist or physician supervision.
              Bioavailability and excipients may differ across manufacturers.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
