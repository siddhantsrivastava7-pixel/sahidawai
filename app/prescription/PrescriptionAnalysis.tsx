'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PrescriptionAnalysis, PrescriptionItem } from '@/app/api/prescription/route'
import { VERDICT_META } from '@/lib/safety'
import { SafetyVerdict } from '@/types'

// ── Small components ────────────────────────────────────────────────────────

function VerdictBadge({ verdict }: { verdict: SafetyVerdict }) {
  const m = VERDICT_META[verdict]
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${m.color}`}>
      {m.icon} {m.label}
    </span>
  )
}

// ── Monthly cost hero banner ─────────────────────────────────────────────────

function MonthlyCostHero({ analysis }: { analysis: PrescriptionAnalysis }) {
  const { total_monthly_current, total_monthly_cheapest, total_monthly_savings, is_chronic_prescription, conditions } = analysis
  const hasSavings = total_monthly_savings > 1
  const savingsPct = total_monthly_current > 0
    ? Math.round((total_monthly_savings / total_monthly_current) * 100)
    : 0

  return (
    <div className="space-y-2.5">
      {/* Condition tags */}
      {conditions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {conditions.map(c => (
            <span key={c.condition} className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${
              c.chronic ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-gray-50 border-gray-100 text-gray-600'
            }`}>
              {c.emoji} {c.condition}
              {c.chronic && <span className="text-[9px] font-bold text-blue-500 uppercase tracking-wide ml-0.5">Chronic</span>}
            </span>
          ))}
        </div>
      )}

      {/* Monthly cost card */}
      {is_chronic_prescription ? (
        <div className="relative rounded-2xl overflow-hidden">
          {/* Current cost header */}
          <div className="bg-gray-900 px-5 pt-5 pb-4">
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">
              Your monthly medicine cost
            </p>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-white text-4xl font-black tracking-tight">
                  ₹{total_monthly_current.toFixed(0)}
                  <span className="text-xl font-semibold text-gray-400"> / month</span>
                </p>
                {hasSavings && (
                  <p className="text-gray-400 text-sm mt-1">
                    at current brands
                  </p>
                )}
              </div>
              {hasSavings && (
                <div className="text-right">
                  <div className="inline-flex items-center gap-1 bg-red-500/20 text-red-400 text-xs font-bold px-2.5 py-1 rounded-full border border-red-500/30">
                    Overpaying
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Arrow + savings */}
          {hasSavings && (
            <div className="relative bg-gradient-to-br from-emerald-600 to-emerald-500 px-5 py-4">
              <div className="absolute -top-3 left-5 w-6 h-6 bg-emerald-600 rotate-45" />
              <p className="text-emerald-200 text-[10px] font-bold uppercase tracking-widest mb-1 relative">
                Switch to cheaper alternatives →
              </p>
              <div className="flex items-end justify-between gap-4 relative">
                <div>
                  <p className="text-white text-4xl font-black tracking-tight">
                    ₹{total_monthly_cheapest.toFixed(0)}
                    <span className="text-xl font-semibold text-emerald-200"> / month</span>
                  </p>
                  <p className="text-emerald-200 text-sm mt-1">
                    Save <strong className="text-white">₹{total_monthly_savings.toFixed(0)}</strong> every month
                    · <strong className="text-white">₹{(total_monthly_savings * 12).toFixed(0)}</strong> a year
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-white text-5xl font-black tracking-tighter leading-none">{savingsPct}%</p>
                  <p className="text-emerald-200 text-xs font-medium">cheaper</p>
                </div>
              </div>
            </div>
          )}

          {!hasSavings && (
            <div className="bg-emerald-600 px-5 py-3">
              <p className="text-emerald-100 text-sm font-semibold">
                ✓ You&apos;re already on the most cost-effective options.
              </p>
            </div>
          )}
        </div>
      ) : (
        // Acute prescription: show course total only
        hasSavings && (
          <div className="relative bg-gradient-to-br from-emerald-700 to-emerald-500 rounded-2xl p-5 overflow-hidden">
            <div className="absolute inset-0 opacity-[0.07]"
              style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
            <div className="relative flex items-end justify-between gap-4 flex-wrap">
              <div>
                <p className="text-emerald-200 text-xs font-semibold uppercase tracking-widest mb-1">
                  Total prescription savings
                </p>
                <p className="text-white text-3xl font-black tracking-tight">
                  ₹{analysis.total_savings.toFixed(0)}
                  <span className="text-lg font-semibold text-emerald-200"> saved</span>
                </p>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <div>
                    <p className="text-emerald-300 text-[10px] font-medium uppercase">Currently</p>
                    <p className="text-white font-bold">₹{analysis.total_current_cost.toFixed(0)}</p>
                  </div>
                  <div className="text-emerald-400 font-bold">→</div>
                  <div>
                    <p className="text-emerald-300 text-[10px] font-medium uppercase">With alts</p>
                    <p className="text-white font-bold">₹{analysis.total_cheapest_cost.toFixed(0)}</p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white text-5xl font-black tracking-tighter leading-none">{savingsPct}%</p>
                <p className="text-emerald-300 text-xs font-medium">cheaper</p>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  )
}

// ── Per-medicine row ─────────────────────────────────────────────────────────

function MedicineRow({ item }: { item: PrescriptionItem }) {
  const router = useRouter()

  const cheapestAlt = item.alternatives?.find(a => a.verdict === 'safe' && a.savings_per_unit > 0)
    ?? item.alternatives?.find(a => a.verdict === 'check_pharmacist' && a.savings_per_unit > 0)

  const hasSavings = (item.monthly_savings ?? 0) > 0.5 || (item.course_savings ?? 0) > 0.5
  const vm = cheapestAlt ? VERDICT_META[cheapestAlt.verdict] : VERDICT_META['safe']

  return (
    <div className={`bg-white rounded-2xl border-l-4 border border-gray-100 p-4 sm:p-5 ${
      cheapestAlt ? vm.borderColor : 'border-l-gray-200'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900 text-sm">{item.name}</p>
            {item.is_chronic && (
              <span className="text-[9px] bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                Chronic
              </span>
            )}
            {!item.found && (
              <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-medium">Not in database</span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
            {item.frequency_label} · {item.duration_days} days · {item.tabs_per_course} tablets
          </p>
          {item.found && <p className="text-[11px] text-gray-400 mt-0.5">{item.product?.manufacturer}</p>}
        </div>

        {/* Cost column */}
        {item.found && (
          <div className="text-right shrink-0">
            {item.is_chronic && item.monthly_cost !== undefined ? (
              <>
                <p className="text-base font-bold text-gray-900">₹{item.monthly_cost.toFixed(0)}</p>
                <p className="text-[10px] text-gray-400 font-medium">/ month</p>
                <p className="text-[10px] text-gray-300 mt-0.5">₹{item.course_cost?.toFixed(0)} for course</p>
              </>
            ) : (
              <>
                <p className="text-base font-bold text-gray-900">₹{item.course_cost?.toFixed(0)}</p>
                <p className="text-[10px] text-gray-400 font-medium">for course</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Cheapest alternative */}
      {item.found && hasSavings && cheapestAlt && (
        <div className="mt-3 rounded-xl border overflow-hidden">
          <div className="flex items-center justify-between bg-emerald-50 border-emerald-100 px-3 py-2.5">
            <div>
              <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wide mb-0.5">Cheapest safe alternative</p>
              <p className="text-sm font-bold text-emerald-800">{cheapestAlt.brand_name}</p>
              <p className="text-[10px] text-emerald-600">{cheapestAlt.manufacturer}</p>
            </div>
            <div className="text-right">
              {item.is_chronic && item.monthly_savings !== undefined ? (
                <>
                  <p className="text-base font-black text-emerald-700">Save ₹{item.monthly_savings.toFixed(0)}/mo</p>
                  <p className="text-[10px] text-emerald-500">₹{(item.monthly_savings * 12).toFixed(0)}/year</p>
                </>
              ) : (
                <p className="text-base font-black text-emerald-700">Save ₹{item.course_savings?.toFixed(0)}</p>
              )}
              <button
                onClick={() => router.push(`/search?q=${encodeURIComponent(item.name)}`)}
                className="mt-1 text-[10px] text-emerald-600 font-semibold hover:underline block"
              >
                See all →
              </button>
            </div>
          </div>
          <div className={`px-3 py-2 text-[11px] font-medium border-t ${
            cheapestAlt.verdict === 'safe'
              ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
              : 'bg-amber-50 border-amber-100 text-amber-700'
          }`}>
            <VerdictBadge verdict={cheapestAlt.verdict} />
            <p className="mt-1 leading-relaxed">{cheapestAlt.explanation}</p>
          </div>
        </div>
      )}

      {item.found && !hasSavings && (
        <p className="text-[11px] text-gray-400 mt-2.5">✓ Already cheapest or no safe alternatives found.</p>
      )}

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

// ── Page ────────────────────────────────────────────────────────────────────

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

  const reset = () => { setStatus('idle'); setAnalysis(null); if (inputRef.current) inputRef.current.value = '' }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <p className="text-[10px] font-bold tracking-[0.2em] text-emerald-600 uppercase mb-2">Prescription Intelligence</p>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Full Prescription Breakdown</h1>
          <p className="text-gray-400 text-sm mt-1.5">
            Upload your prescription — we extract every medicine, calculate your monthly spend, and find safer cheaper alternatives.
          </p>
        </div>

        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

        {/* Upload */}
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
            <div className="flex items-center gap-4 mt-1">
              {['Monthly cost', 'Safer alternatives', 'Condition insights'].map(f => (
                <div key={f} className="flex items-center gap-1 text-[10px] text-gray-300 font-medium">
                  <div className="w-1 h-1 rounded-full bg-emerald-300" />
                  {f}
                </div>
              ))}
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
                <p className="text-xs text-gray-400 mt-0.5">Reading medicines · Calculating monthly costs · Finding alternatives</p>
              </div>
            </div>
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
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
            {/* Monthly cost hero */}
            <MonthlyCostHero analysis={analysis} />

            <div className="flex items-center justify-between py-1">
              <p className="text-[10px] font-bold tracking-[0.2em] text-gray-400 uppercase">
                {analysis.items.length} Medicine{analysis.items.length !== 1 ? 's' : ''}
              </p>
              <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 transition-colors font-medium">
                ↺ Upload another
              </button>
            </div>

            {analysis.items.map((item, i) => <MedicineRow key={i} item={item} />)}

            <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs text-gray-400 leading-relaxed mt-2">
              <strong className="text-gray-500">Disclaimer:</strong> Always switch medicines under pharmacist or physician supervision.
              Monthly costs are estimated at 30 days × prescribed daily dose.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
