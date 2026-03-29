'use client'
import { useState } from 'react'
import { Alternative, Product, Savings, SafetyVerdict } from '@/types'
import { VERDICT_META } from '@/lib/safety'
import { TIER_META } from '@/lib/manufacturer'

interface Props {
  product: Product
  alternatives: Alternative[]
  savings: Savings | null
}

async function sendFeedback(productId: string, alternativeId: string, action: string) {
  try {
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, alternative_id: alternativeId, action }),
    })
  } catch { /* fire-and-forget */ }
}

function VerdictBadge({ verdict }: { verdict: SafetyVerdict }) {
  const m = VERDICT_META[verdict]
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${m.color}`}>
      {m.icon} {m.label}
    </span>
  )
}

function ExplanationRow({ explanation, verdict }: { explanation: string; verdict: SafetyVerdict }) {
  const [open, setOpen] = useState(false)
  const isWarning = verdict === 'do_not_substitute' || verdict === 'check_doctor'

  return (
    <div className={`mt-2.5 rounded-xl text-xs leading-relaxed px-3 py-2.5 border ${
      isWarning ? 'bg-red-50 border-red-100 text-red-700' :
      verdict === 'check_pharmacist' ? 'bg-amber-50 border-amber-100 text-amber-700' :
      'bg-emerald-50 border-emerald-100 text-emerald-700'
    }`}>
      {open || explanation.length <= 100
        ? explanation
        : <>{explanation.slice(0, 100)}… <button onClick={() => setOpen(true)} className="font-semibold underline underline-offset-2">more</button></>
      }
    </div>
  )
}

type FilterMode = 'cheapest' | 'trusted'

function ManufacturerBadge({ alt }: { alt: Alternative }) {
  const tier = alt.manufacturer_tier ?? 'unverified'
  const m = TIER_META[tier]
  return (
    <span
      title={alt.manufacturer_notes ?? m.label}
      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border cursor-help ${m.color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.icon} {tier === 'trusted'
        ? alt.manufacturer_has_us_fda ? 'WHO-GMP · US FDA' : 'WHO-GMP'
        : m.label}
    </span>
  )
}

export default function AlternativesTable({ product, alternatives, savings }: Props) {
  const [showUnsafe, setShowUnsafe] = useState(false)
  const [filterMode, setFilterMode] = useState<FilterMode>('cheapest')
  const [flagged, setFlagged] = useState<Record<string, boolean>>({})

  const handleFlag = (altId: string) => {
    setFlagged(prev => ({ ...prev, [altId]: true }))
    void sendFeedback(product.id, altId, 'flagged_wrong')
  }

  if (!alternatives.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <div className="text-3xl mb-3">🏷️</div>
        <p className="text-gray-500 text-sm font-medium">No alternatives found for this composition.</p>
        <p className="text-gray-300 text-xs mt-1">This may be the only brand in our database.</p>
      </div>
    )
  }

  const safe = alternatives.filter(a => a.verdict === 'safe' || a.verdict === 'check_pharmacist')
  const unsafe = alternatives.filter(a => a.verdict === 'check_doctor' || a.verdict === 'do_not_substitute')

  const filteredSafe = filterMode === 'trusted'
    ? safe.filter(a => a.manufacturer_tier === 'trusted')
    : safe

  const cheaper = filteredSafe.filter(a => a.savings_per_unit > 0)
  const costlier = filteredSafe.filter(a => a.savings_per_unit <= 0)

  const [showCostlier, setShowCostlier] = useState(false)
  const visibleSafe = showCostlier ? filteredSafe : cheaper

  return (
    <div className="space-y-2.5">

      {/* Savings banner */}
      {savings ? (
        <div className="relative bg-gradient-to-br from-emerald-700 to-emerald-500 rounded-2xl p-5 overflow-hidden">
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
          <div className="relative flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-emerald-200 text-xs font-medium tracking-wide uppercase mb-1">Maximum you can save</p>
              <p className="text-white text-3xl font-black tracking-tight">
                ₹{savings.per_month_2x.toFixed(0)}<span className="text-lg font-semibold text-emerald-200"> / month</span>
              </p>
              <p className="text-emerald-300 text-xs mt-1">
                ₹{Number(savings.per_unit).toFixed(2)} less per tablet vs {savings.vs_brand}
              </p>
            </div>
            <div className="text-right">
              <p className="text-white text-5xl font-black tracking-tighter leading-none">{savings.pct}%</p>
              <p className="text-emerald-300 text-xs font-medium mt-0.5">cheaper</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3.5 text-sm text-amber-700 font-medium">
          ✓ Already the cheapest safe option in our database for this composition.
        </div>
      )}

      {/* Filter toggle */}
      <div className="flex items-center gap-1.5 p-1 bg-gray-50 border border-gray-100 rounded-xl w-fit">
        <button
          onClick={() => setFilterMode('cheapest')}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
            filterMode === 'cheapest'
              ? 'bg-white text-gray-900 shadow-sm border border-gray-100'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          Cheapest
        </button>
        <button
          onClick={() => setFilterMode('trusted')}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
            filterMode === 'trusted'
              ? 'bg-white text-emerald-700 shadow-sm border border-emerald-100'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <span>🛡</span> Trusted manufacturer
        </button>
      </div>

      {/* Trusted filter — no results */}
      {filterMode === 'trusted' && filteredSafe.length === 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700 font-medium">
          No alternatives from trusted manufacturers found for this composition. Showing all alternatives instead.
        </div>
      )}

      {/* Safe alternatives */}
      {visibleSafe.length === 0 && cheaper.length === 0 && (
        <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3.5 text-sm text-gray-500 font-medium text-center">
          No cheaper safe alternatives found.
        </div>
      )}

      {visibleSafe.map((alt, i) => {
        const altPPU = Number(alt.price_per_unit)
        const isCheaper = alt.savings_per_unit > 0
        const isBest = i === 0 && isCheaper && alt.verdict === 'safe'
        const pct = Number(alt.savings_pct)
        const vm = VERDICT_META[alt.verdict]

        return (
          <div key={alt.id} className={`bg-white rounded-2xl border-l-4 border border-gray-100 p-4 transition-all duration-150 hover:shadow-md ${vm.borderColor}`}>
            <div className="flex items-start gap-4">
              {/* Rank */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-0.5
                ${isBest ? 'bg-emerald-600 text-white' : 'bg-gray-50 text-gray-400'}`}>
                {i + 1}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900 text-sm">{alt.brand_name}</p>
                  {isBest && (
                    <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide">
                      BEST PRICE
                    </span>
                  )}
                  {alt.is_generic && (
                    <span className="bg-blue-50 text-blue-600 text-[10px] px-2 py-0.5 rounded-full border border-blue-100 font-medium">Generic</span>
                  )}
                  {alt.is_jan_aushadhi && (
                    <span className="bg-orange-50 text-orange-600 text-[10px] px-2 py-0.5 rounded-full border border-orange-100 font-medium">Jan Aushadhi</span>
                  )}
                </div>

                <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
                  {alt.manufacturer} · {alt.unit_per_pack} tabs · MRP ₹{Number(alt.mrp).toFixed(2)}
                  {alt.release_type && alt.release_type !== 'IR' && (
                    <span className="ml-1.5 text-amber-600 font-semibold">{alt.release_type}</span>
                  )}
                </p>

                {/* Manufacturer trust + safety verdict */}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <ManufacturerBadge alt={alt} />
                  <VerdictBadge verdict={alt.verdict} />
                </div>

                {/* Explanation */}
                <ExplanationRow explanation={alt.explanation} verdict={alt.verdict} />
              </div>

              {/* Price + flag */}
              <div className="text-right shrink-0">
                <p className="text-lg font-bold text-gray-900">₹{altPPU.toFixed(2)}</p>
                <p className="text-[10px] text-gray-400 font-medium">per tablet</p>
                {isCheaper ? (
                  <span className="inline-block bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 border border-emerald-100">
                    Save {pct}%
                  </span>
                ) : (
                  <span className="inline-block bg-red-50 text-red-500 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 border border-red-100">
                    +{Math.abs(pct)}% costlier
                  </span>
                )}
                <div className="mt-2">
                  {flagged[alt.id] ? (
                    <span className="text-[10px] text-red-400 font-medium">🚩 Flagged</span>
                  ) : (
                    <button
                      onClick={() => handleFlag(alt.id)}
                      title="Flag as wrong alternative"
                      className="text-gray-200 hover:text-red-400 transition-colors text-xs"
                    >
                      🚩 Wrong?
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {/* Toggle costlier safe options */}
      {costlier.length > 0 && (
        <button
          onClick={() => setShowCostlier(v => !v)}
          className="w-full text-center text-xs text-gray-400 font-medium py-2.5 hover:text-gray-600 transition-colors"
        >
          {showCostlier
            ? `Hide ${costlier.length} more expensive option${costlier.length !== 1 ? 's' : ''} ↑`
            : `Show ${costlier.length} more expensive option${costlier.length !== 1 ? 's' : ''} ↓`}
        </button>
      )}

      {/* Unsafe section */}
      {unsafe.length > 0 && (
        <div className="border-t border-gray-100 pt-2.5">
          <button
            onClick={() => setShowUnsafe(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-semibold hover:bg-red-100 transition-colors"
          >
            <span>⚠ {unsafe.length} unsafe alternative{unsafe.length !== 1 ? 's' : ''} hidden</span>
            <span>{showUnsafe ? '↑ Hide' : '↓ Show anyway'}</span>
          </button>

          {showUnsafe && unsafe.map((alt) => {
            const vm = VERDICT_META[alt.verdict]
            return (
              <div key={alt.id} className={`mt-2 bg-white rounded-2xl border-l-4 border border-gray-100 p-4 opacity-80 ${vm.borderColor}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{alt.brand_name}</p>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">{alt.manufacturer} · MRP ₹{Number(alt.mrp).toFixed(2)}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <ManufacturerBadge alt={alt} />
                      <VerdictBadge verdict={alt.verdict} />
                    </div>
                    <ExplanationRow explanation={alt.explanation} verdict={alt.verdict} />
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold text-gray-900">₹{Number(alt.price_per_unit).toFixed(2)}</p>
                    <p className="text-[10px] text-gray-400">per tablet</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
