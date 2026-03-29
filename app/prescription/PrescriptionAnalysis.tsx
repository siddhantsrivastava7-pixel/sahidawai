'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PrescriptionAnalysis, PrescriptionItem } from '@/app/api/prescription/route'
import { VERDICT_META } from '@/lib/safety'
import { SafetyVerdict } from '@/types'

function VerdictBadge({ verdict }: { verdict: SafetyVerdict }) {
  const m = VERDICT_META[verdict]
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${m.color}`}>
      {m.icon} {m.label}
    </span>
  )
}

// ── Savings hero ─────────────────────────────────────────────────────────────

function SavingsHero({ analysis }: { analysis: PrescriptionAnalysis }) {
  const {
    total_monthly_savings, total_monthly_current, total_monthly_cheapest,
    is_chronic_prescription, total_savings, total_current_cost, total_cheapest_cost,
    conditions,
  } = analysis

  const hasSavings = is_chronic_prescription ? total_monthly_savings > 1 : total_savings > 1
  const displaySavings = is_chronic_prescription ? total_monthly_savings : total_savings
  const displayCurrent = is_chronic_prescription ? total_monthly_current : total_current_cost
  const displayCheapest = is_chronic_prescription ? total_monthly_cheapest : total_cheapest_cost
  const unit = is_chronic_prescription ? '/month' : 'on this course'
  const savingsPct = displayCurrent > 0 ? Math.round((displaySavings / displayCurrent) * 100) : 0

  return (
    <div className="space-y-3">
      {/* Condition pills — horizontally scrollable */}
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

      {/* Hero card */}
      {hasSavings ? (
        <div className="bg-gray-900 rounded-2xl overflow-hidden">
          <div className="px-5 pt-5 pb-4">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">You could save</p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-white text-5xl font-black tracking-tight leading-none">
                  ₹{displaySavings.toFixed(0)}
                </p>
                <p className="text-gray-400 text-sm mt-2">{unit}</p>
              </div>
              <div className="text-right">
                <p className="text-emerald-400 text-4xl font-black tracking-tighter leading-none">{savingsPct}%</p>
                <p className="text-gray-500 text-xs mt-1">cheaper</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-800 px-5 py-3 flex items-center justify-between">
            <p className="text-sm">
              <span className="text-gray-500 line-through">₹{displayCurrent.toFixed(0)}</span>
              <span className="text-white font-bold ml-2">→ ₹{displayCheapest.toFixed(0)}</span>
            </p>
            {is_chronic_prescription && (
              <span className="text-emerald-400 text-xs font-semibold">
                ₹{(total_monthly_savings * 12).toFixed(0)}/year
              </span>
            )}
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
  const [showAlts, setShowAlts] = useState(false)

  const cheapestAlt = item.alternatives?.find(a => a.verdict === 'safe' && a.savings_per_unit > 0)
    ?? item.alternatives?.find(a => a.verdict === 'check_pharmacist' && a.savings_per_unit > 0)

  const hasSavings = (item.monthly_savings ?? 0) > 0.5 || (item.course_savings ?? 0) > 0.5
  const displayCost = item.is_chronic ? item.monthly_cost : item.course_cost
  const displaySavings = item.is_chronic ? item.monthly_savings : item.course_savings
  const costLabel = item.is_chronic ? '/month' : 'for course'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Accent bar */}
      <div className={`h-1 ${hasSavings && cheapestAlt ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gray-100'}`} />

      <div className="p-5">
        {/* Name + badges */}
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-lg leading-tight">{item.name}</h3>
            <p className="text-sm text-gray-400 mt-0.5">
              {item.frequency_label} · {item.duration_days} day{item.duration_days !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            {item.is_chronic && (
              <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full font-bold uppercase">
                Chronic
              </span>
            )}
            {!item.found && (
              <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-medium">Not found</span>
            )}
          </div>
        </div>

        {item.found && (
          <>
            {/* Cost vs savings */}
            <div className="flex items-stretch gap-3 mb-4">
              <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mb-1">Current cost</p>
                <p className="text-2xl font-black text-gray-900 leading-none">₹{displayCost?.toFixed(0)}</p>
                <p className="text-[11px] text-gray-400 mt-1">{costLabel}</p>
              </div>
              {hasSavings && displaySavings && (
                <div className="flex-1 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wide mb-1">You save</p>
                  <p className="text-2xl font-black text-emerald-600 leading-none">₹{displaySavings.toFixed(0)}</p>
                  <p className="text-[11px] text-emerald-500 mt-1">{costLabel}</p>
                </div>
              )}
            </div>

            {/* Cheapest alt CTA */}
            {hasSavings && cheapestAlt && !showAlts && (
              <button
                onClick={() => setShowAlts(true)}
                className="w-full flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3.5 text-left active:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0 pr-3">
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wide mb-1">Cheapest safe option</p>
                  <p className="text-sm font-bold text-gray-900 truncate">{cheapestAlt.brand_name}</p>
                  <div className="mt-1.5">
                    <VerdictBadge verdict={cheapestAlt.verdict} />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-black text-gray-900">₹{Number(cheapestAlt.price_per_unit).toFixed(2)}</p>
                  <p className="text-[10px] text-gray-400">per tablet</p>
                  <p className="text-emerald-600 text-xs font-bold mt-1.5">See options →</p>
                </div>
              </button>
            )}

            {/* Expanded alternatives */}
            {showAlts && (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Alternatives</p>
                  <button onClick={() => setShowAlts(false)} className="text-xs text-gray-400 font-semibold py-1 px-2">
                    Hide ↑
                  </button>
                </div>
                {item.alternatives
                  ?.filter(a => a.verdict === 'safe' || a.verdict === 'check_pharmacist')
                  .slice(0, 5)
                  .map(alt => (
                    <div key={alt.id} className="bg-white border border-gray-100 rounded-xl p-3.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{alt.brand_name}</p>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">{alt.manufacturer}</p>
                        <div className="mt-1.5">
                          <VerdictBadge verdict={alt.verdict} />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-base font-bold text-gray-900">₹{Number(alt.price_per_unit).toFixed(2)}</p>
                        <p className="text-[10px] text-gray-400">per tab</p>
                        {alt.savings_per_unit > 0 && (
                          <span className="inline-block mt-1 text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-100">
                            Save {Number(alt.savings_pct).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                <button
                  onClick={() => router.push(`/search?q=${encodeURIComponent(item.name)}`)}
                  className="w-full text-center text-sm text-emerald-600 font-bold py-3 border border-emerald-100 rounded-xl bg-emerald-50 active:bg-emerald-100"
                >
                  Full comparison →
                </button>
              </div>
            )}

            {!hasSavings && (
              <p className="text-xs text-gray-400">✓ Already cheapest — no cheaper safe alternatives found.</p>
            )}
          </>
        )}

        {!item.found && (
          <button
            onClick={() => router.push(`/search?q=${encodeURIComponent(item.name)}`)}
            className="text-sm text-emerald-600 font-bold"
          >
            Search manually →
          </button>
        )}
      </div>
    </div>
  )
}

// ── Swipeable carousel ────────────────────────────────────────────────────────

function MedicineCarousel({ items }: { items: PrescriptionItem[] }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  const prev = () => setActiveIdx(i => Math.max(0, i - 1))
  const next = () => setActiveIdx(i => Math.min(items.length - 1, i + 1))

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = touchStartX.current - e.changedTouches[0].clientX
    const dy = Math.abs(touchStartY.current - e.changedTouches[0].clientY)
    if (dy > Math.abs(dx) || Math.abs(dx) < 40) return
    if (dx > 0) next()
    else prev()
  }

  return (
    <div className="space-y-4">
      {/* Counter + dots */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Medicine {activeIdx + 1} of {items.length}
        </p>
        {items.length > 1 && (
          <div className="flex items-center gap-1.5">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIdx(i)}
                className={`rounded-full transition-all duration-200 ${
                  i === activeIdx ? 'w-5 h-2 bg-emerald-500' : 'w-2 h-2 bg-gray-200'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Card */}
      <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <MedicineCard item={items[activeIdx]} />
      </div>

      {/* Prev / Next */}
      {items.length > 1 && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={prev}
            disabled={activeIdx === 0}
            className="py-3.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 disabled:opacity-25 active:bg-gray-50 transition-colors"
          >
            ← Previous
          </button>
          <button
            onClick={next}
            disabled={activeIdx === items.length - 1}
            className="py-3.5 rounded-xl bg-emerald-600 text-sm font-bold text-white disabled:opacity-25 active:bg-emerald-700 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pt-8 pb-16">

        {/* Header */}
        {status !== 'done' && (
          <div className="mb-8">
            <p className="text-[10px] font-bold tracking-[0.2em] text-emerald-600 uppercase mb-2">Prescription scan</p>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Find cheaper medicines</h1>
            <p className="text-gray-400 text-sm mt-1.5">
              Upload your prescription — we find you savings instantly.
            </p>
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
              {[
                { icon: '💰', label: 'Monthly savings' },
                { icon: '🛡', label: 'Safety check' },
                { icon: '🏥', label: 'Condition hints' },
              ].map(f => (
                <div key={f.label} className="bg-white border border-gray-100 rounded-xl p-4 text-center shadow-sm">
                  <p className="text-2xl mb-2">{f.icon}</p>
                  <p className="text-[11px] font-semibold text-gray-600 leading-tight">{f.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {status === 'loading' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center py-12 gap-5">
              <div className="flex items-center gap-2">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-3 h-3 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-gray-800">Analysing prescription…</p>
                <p className="text-sm text-gray-400 mt-1">Reading medicines · Finding alternatives</p>
              </div>
            </div>
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 bg-white rounded-2xl border border-gray-100 animate-pulse" />
            ))}
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5 text-3xl">📋</div>
            <p className="text-gray-900 font-bold text-base mb-1">{errorMsg}</p>
            <p className="text-gray-400 text-sm mb-7 max-w-xs mx-auto">Try a clearer photo with good lighting and the full prescription visible.</p>
            <button onClick={reset} className="bg-emerald-600 text-white text-sm font-bold px-7 py-3.5 rounded-xl active:bg-emerald-700">
              Try again
            </button>
          </div>
        )}

        {/* Results */}
        {status === 'done' && analysis && (
          <div className="space-y-5">
            {/* Results header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Your prescription</h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  {analysis.items.length} medicine{analysis.items.length !== 1 ? 's' : ''} found
                </p>
              </div>
              <button
                onClick={reset}
                className="text-sm text-gray-500 font-semibold bg-gray-100 px-3.5 py-2 rounded-xl active:bg-gray-200"
              >
                ↺ New scan
              </button>
            </div>

            <SavingsHero analysis={analysis} />

            <MedicineCarousel items={analysis.items} />

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
