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
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${m.color}`}>
      {m.icon} {m.label}
    </span>
  )
}

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

function ExplanationRow({ explanation, verdict }: { explanation: string; verdict: SafetyVerdict }) {
  const [open, setOpen] = useState(false)
  const isWarning = verdict === 'do_not_substitute' || verdict === 'check_doctor'
  return (
    <div className={`mt-2 rounded-xl text-xs leading-relaxed px-3 py-2.5 border ${
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

export default function AlternativesTable({ product, alternatives, savings }: Props) {
  const [showUnsafe, setShowUnsafe] = useState(false)
  const [filterMode, setFilterMode] = useState<FilterMode>('cheapest')
  const [flagged, setFlagged] = useState<Record<string, boolean>>({})
  const [showCostlier, setShowCostlier] = useState(false)

  const handleFlag = (altId: string) => {
    setFlagged(prev => ({ ...prev, [altId]: true }))
    void sendFeedback(product.id, altId, 'flagged_wrong')
  }

  if (!alternatives.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-sm">
        <div className="text-3xl mb-3">🏷️</div>
        <p className="text-gray-600 text-sm font-semibold">No alternatives found for this composition.</p>
        <p className="text-gray-400 text-xs mt-1">This may be the only brand in our database.</p>
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
  const visibleSafe = showCostlier ? filteredSafe : cheaper

  return (
    <div className="space-y-3">

      {/* Savings banner */}
      {savings ? (
        <div className="bg-gray-900 rounded-2xl overflow-hidden">
          <div className="px-5 pt-5 pb-4">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">Maximum you can save</p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-white text-4xl font-black tracking-tight leading-none">
                  ₹{savings.per_month_2x.toFixed(0)}
                  <span className="text-lg font-semibold text-gray-400 ml-1">/ month</span>
                </p>
                <p className="text-gray-400 text-sm mt-2">
                  ₹{Number(savings.per_unit).toFixed(2)} less per tablet vs {savings.vs_brand}
                </p>
              </div>
              <div className="text-right">
                <p className="text-emerald-400 text-4xl font-black tracking-tighter leading-none">{savings.pct}%</p>
                <p className="text-gray-500 text-xs mt-1">cheaper</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3.5 flex items-center gap-3">
          <span className="text-xl">✅</span>
          <p className="text-sm text-emerald-700 font-semibold">Already the cheapest safe option in our database.</p>
        </div>
      )}

      {/* Filter toggle */}
      <div className="flex items-center gap-1.5 p-1 bg-gray-50 border border-gray-100 rounded-xl">
        <button
          onClick={() => setFilterMode('cheapest')}
          className={`flex-1 text-sm font-semibold py-2.5 rounded-lg transition-all ${
            filterMode === 'cheapest'
              ? 'bg-white text-gray-900 shadow-sm border border-gray-100'
              : 'text-gray-400'
          }`}
        >
          Cheapest
        </button>
        <button
          onClick={() => setFilterMode('trusted')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 rounded-lg transition-all ${
            filterMode === 'trusted'
              ? 'bg-white text-emerald-700 shadow-sm border border-emerald-100'
              : 'text-gray-400'
          }`}
        >
          🛡 Trusted
        </button>
      </div>

      {/* No trusted manufacturers note */}
      {filterMode === 'trusted' && filteredSafe.length === 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700 font-medium">
          No trusted-manufacturer alternatives found. Showing all alternatives instead.
        </div>
      )}

      {/* No cheaper safe options */}
      {visibleSafe.length === 0 && cheaper.length === 0 && (
        <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-4 text-sm text-gray-500 font-medium text-center">
          No cheaper safe alternatives found.
        </div>
      )}

      {/* Alternative cards */}
      {visibleSafe.map((alt, i) => {
        const altPPU = Number(alt.price_per_unit)
        const isCheaper = alt.savings_per_unit > 0
        const isBest = i === 0 && isCheaper && alt.verdict === 'safe'
        const pct = Number(alt.savings_pct)
        const vm = VERDICT_META[alt.verdict]

        return (
          <div key={alt.id} className={`bg-white rounded-2xl border-l-4 border border-gray-100 overflow-hidden transition-all hover:shadow-md ${vm.borderColor}`}>
            <div className="p-4">
              <div className="flex items-start gap-3">
                {/* Rank */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 ${
                  isBest ? 'bg-emerald-600 text-white' : 'bg-gray-50 text-gray-400 border border-gray-100'
                }`}>
                  {i + 1}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-900">{alt.brand_name}</p>
                        {isBest && (
                          <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            BEST PRICE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 font-medium">
                        {alt.manufacturer} · {alt.unit_per_pack} tabs
                        {alt.release_type && alt.release_type !== 'IR' && (
                          <span className="ml-1.5 text-amber-600 font-semibold">{alt.release_type}</span>
                        )}
                      </p>
                    </div>

                    {/* Price */}
                    <div className="text-right shrink-0">
                      <p className="text-xl font-black text-gray-900">₹{altPPU.toFixed(2)}</p>
                      <p className="text-[10px] text-gray-400 font-medium">per tablet</p>
                      {isCheaper ? (
                        <span className="inline-block mt-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-100">
                          Save {pct}%
                        </span>
                      ) : (
                        <span className="inline-block mt-1 bg-red-50 text-red-500 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-100">
                          +{Math.abs(pct)}% costlier
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badges row */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(alt.is_generic || alt.is_jan_aushadhi) && (
                      <>
                        {alt.is_generic && (
                          <span className="bg-blue-50 text-blue-600 text-[10px] px-2 py-0.5 rounded-full border border-blue-100 font-medium">Generic</span>
                        )}
                        {alt.is_jan_aushadhi && (
                          <span className="bg-orange-50 text-orange-600 text-[10px] px-2 py-0.5 rounded-full border border-orange-100 font-medium">Jan Aushadhi</span>
                        )}
                      </>
                    )}
                    <ManufacturerBadge alt={alt} />
                    <VerdictBadge verdict={alt.verdict} />
                  </div>

                  <ExplanationRow explanation={alt.explanation} verdict={alt.verdict} />

                  {/* Flag */}
                  <div className="mt-2.5 flex justify-end">
                    {flagged[alt.id] ? (
                      <span className="text-[10px] text-red-400 font-medium">🚩 Flagged</span>
                    ) : (
                      <button
                        onClick={() => handleFlag(alt.id)}
                        title="Flag as wrong alternative"
                        className="text-gray-300 hover:text-red-400 transition-colors text-xs py-1 px-2 -mr-1"
                      >
                        🚩 Wrong?
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {/* Toggle costlier */}
      {costlier.length > 0 && (
        <button
          onClick={() => setShowCostlier(v => !v)}
          className="w-full text-center text-sm text-gray-400 font-semibold py-3 border border-gray-100 rounded-xl bg-white hover:text-gray-600 transition-colors"
        >
          {showCostlier
            ? `Hide ${costlier.length} more expensive option${costlier.length !== 1 ? 's' : ''} ↑`
            : `Show ${costlier.length} more expensive option${costlier.length !== 1 ? 's' : ''} ↓`}
        </button>
      )}

      {/* Unsafe section */}
      {unsafe.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowUnsafe(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 font-bold active:bg-red-100 transition-colors"
          >
            <span>⚠ {unsafe.length} unsafe alternative{unsafe.length !== 1 ? 's' : ''} hidden</span>
            <span>{showUnsafe ? '↑ Hide' : 'Show anyway ↓'}</span>
          </button>

          {showUnsafe && unsafe.map((alt) => {
            const vm = VERDICT_META[alt.verdict]
            return (
              <div key={alt.id} className={`bg-white rounded-2xl border-l-4 border border-gray-100 p-4 opacity-80 ${vm.borderColor}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900">{alt.brand_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{alt.manufacturer} · MRP ₹{Number(alt.mrp).toFixed(2)}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <ManufacturerBadge alt={alt} />
                      <VerdictBadge verdict={alt.verdict} />
                    </div>
                    <ExplanationRow explanation={alt.explanation} verdict={alt.verdict} />
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-gray-900">₹{Number(alt.price_per_unit).toFixed(2)}</p>
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
