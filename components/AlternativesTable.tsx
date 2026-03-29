'use client'
import { useState } from 'react'
import { Alternative, Product, Savings } from '@/types'

interface Props {
  product: Product
  alternatives: Alternative[]
  savings: Savings | null
}

async function sendFeedback(productId: string, alternativeId: string, action: string, sessionId?: string) {
  try {
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, alternative_id: alternativeId, action, session_id: sessionId }),
    })
  } catch {
    // fire-and-forget — swallow errors silently
  }
}

const WARNING_META = {
  release_type_mismatch: {
    label: 'Different release type',
    detail: 'IR↔SR/XR swap can be dangerous — do not substitute without prescription.',
    color: 'text-red-600 bg-red-50 border-red-100',
  },
  strength_mismatch: {
    label: 'Different strength',
    detail: 'This brand has a different dose of the active ingredient — not interchangeable without a new prescription.',
    color: 'text-red-600 bg-red-50 border-red-100',
  },
  narrow_therapeutic_index: {
    label: 'Narrow therapeutic index',
    detail: 'Small dose changes can cause toxicity or loss of effect. Switch only under physician supervision.',
    color: 'text-amber-700 bg-amber-50 border-amber-100',
  },
  critical_drug: {
    label: 'Critical drug',
    detail: 'Do not switch without physician guidance.',
    color: 'text-amber-700 bg-amber-50 border-amber-100',
  },
} as const

function ConfidenceBadge({ score }: { score: number }) {
  const { label, cls } = score >= 85
    ? { label: 'High confidence', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' }
    : score >= 60
    ? { label: 'Moderate', cls: 'bg-amber-50 text-amber-700 border-amber-100' }
    : { label: 'Use caution', cls: 'bg-red-50 text-red-600 border-red-100' }

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${score >= 85 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} />
      {label}
    </span>
  )
}

export default function AlternativesTable({ product, alternatives, savings }: Props) {
  const [showCostlier, setShowCostlier] = useState(false)
  const [flagged, setFlagged] = useState<Record<string, 'wrong' | 'correct'>>({})

  const handleFlag = (altId: string, action: 'flagged_wrong' | 'flagged_correct') => {
    setFlagged(prev => ({ ...prev, [altId]: action === 'flagged_wrong' ? 'wrong' : 'correct' }))
    void sendFeedback(product.id, altId, action)
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

  const cheaper = alternatives.filter(a => a.savings_per_unit > 0)
  const costlier = alternatives.filter(a => a.savings_per_unit <= 0)
  const unsafeCount = alternatives.filter(a => !a.is_safe_substitute).length
  const visibleAlts = showCostlier ? alternatives : cheaper

  return (
    <div className="space-y-2.5">
      {/* Savings banner */}
      {savings ? (
        <div className="relative bg-gradient-to-br from-emerald-700 to-emerald-500 rounded-2xl p-5 overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '18px 18px' }}
          />
          <div className="relative flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-emerald-200 text-xs font-medium tracking-wide uppercase mb-1">Maximum you can save</p>
              <p className="text-white text-3xl font-black tracking-tight">₹{savings.per_month_2x.toFixed(0)}<span className="text-lg font-semibold text-emerald-200"> / month</span></p>
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
          ✓ Already the cheapest option in our database for this composition.
        </div>
      )}

      {/* Unsafe alternatives notice */}
      {unsafeCount > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600 leading-relaxed">
          <strong>⚠ {unsafeCount} alternative{unsafeCount > 1 ? 's' : ''} flagged</strong> — release type or safety concern detected.
          Flagged options are shown below but <strong>must not be substituted without a prescription.</strong>
        </div>
      )}

      {/* Alternatives list */}
      {visibleAlts.map((alt, i) => {
        const altPPU = Number(alt.price_per_unit)
        const isCheaper = alt.savings_per_unit > 0
        const isBest = i === 0 && isCheaper && alt.is_safe_substitute
        const pct = Number(alt.savings_pct)
        const hasWarnings = alt.substitution_warnings.length > 0

        return (
          <div
            key={alt.id}
            className={`bg-white rounded-2xl border p-4 transition-all duration-150 hover:shadow-md
              ${isBest
                ? 'border-emerald-200 shadow-[0_2px_12px_rgba(16,185,129,0.08)]'
                : hasWarnings
                ? 'border-red-100 shadow-[0_1px_4px_rgba(239,68,68,0.06)]'
                : 'border-gray-100 shadow-[0_1px_4px_rgba(0,0,0,0.04)]'
              }`}
          >
            <div className="flex items-start gap-4">
              {/* Rank */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-0.5
                ${isBest ? 'bg-emerald-600 text-white' : hasWarnings ? 'bg-red-50 text-red-400' : i < 3 ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400'}`}>
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
                    <span className="bg-blue-50 text-blue-600 text-[10px] px-2 py-0.5 rounded-full border border-blue-100 font-medium">
                      Generic
                    </span>
                  )}
                  {alt.is_jan_aushadhi && (
                    <span className="bg-orange-50 text-orange-600 text-[10px] px-2 py-0.5 rounded-full border border-orange-100 font-medium">
                      Jan Aushadhi
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
                  {alt.manufacturer} · {alt.unit_per_pack} tabs · MRP ₹{Number(alt.mrp).toFixed(2)}
                  {alt.release_type && alt.release_type !== 'IR' && (
                    <span className="ml-1.5 text-amber-600 font-semibold">{alt.release_type}</span>
                  )}
                </p>

                {/* Confidence + warnings */}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <ConfidenceBadge score={alt.confidence_score} />
                  {alt.substitution_warnings.map(w => (
                    <span
                      key={w}
                      title={WARNING_META[w].detail}
                      className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border cursor-help ${WARNING_META[w].color}`}
                    >
                      ⚠ {WARNING_META[w].label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Price */}
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
                    <span className={`text-[10px] font-medium ${flagged[alt.id] === 'wrong' ? 'text-red-400' : 'text-emerald-600'}`}>
                      {flagged[alt.id] === 'wrong' ? '🚩 Flagged' : '✓ Confirmed'}
                    </span>
                  ) : (
                    <button
                      onClick={() => handleFlag(alt.id, 'flagged_wrong')}
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

      {/* Toggle for costlier alternatives */}
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
    </div>
  )
}
