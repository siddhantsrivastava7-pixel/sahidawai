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

// ── Confidence bar (out of 100) ────────────────────────────────────────────

function ConfidenceBar({ score }: { score: number }) {
  // safe=92, check_pharmacist=55, check_doctor=40, do_not_substitute=5–18
  const pct = Math.min(100, Math.max(0, score))
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-bold text-gray-400 tabular-nums w-7 text-right">{pct}%</span>
    </div>
  )
}

// ── Safety explanation — "Why this is safe" ───────────────────────────────

function SafetyPanel({ explanation, verdict }: { explanation: string; verdict: SafetyVerdict }) {
  const [open, setOpen] = useState(false)
  const isUnsafe = verdict === 'do_not_substitute' || verdict === 'check_doctor'
  const isAmber = verdict === 'check_pharmacist'

  const bg = isUnsafe ? 'bg-red-50 border-red-100 text-red-700'
    : isAmber ? 'bg-amber-50 border-amber-100 text-amber-700'
    : 'bg-emerald-50 border-emerald-100 text-emerald-700'

  const label = isUnsafe ? 'Why you should be careful'
    : isAmber ? 'What to check with your pharmacist'
    : 'Why this is safe'

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-colors ${bg}`}
      >
        <span>{label}</span>
        <span className="ml-2 shrink-0">{open ? '↑' : '↓'}</span>
      </button>
      {open && (
        <div className={`mt-1.5 px-3.5 py-3 rounded-xl border text-xs leading-relaxed ${bg}`}>
          {explanation}
        </div>
      )}
    </div>
  )
}

// ── Manufacturer badge ─────────────────────────────────────────────────────

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

// ── Single alternative card ────────────────────────────────────────────────

function AltCard({
  alt,
  rank,
  isBest,
  productId,
  flagged,
  onFlag,
}: {
  alt: Alternative
  rank: number
  isBest: boolean
  productId: string
  flagged: boolean
  onFlag: () => void
}) {
  const altPPU = Number(alt.price_per_unit)
  const isCheaper = alt.savings_per_unit > 0
  const pct = Number(alt.savings_pct)
  const vm = VERDICT_META[alt.verdict]

  return (
    <div className={`bg-white rounded-2xl overflow-hidden border transition-all ${
      isBest ? 'border-emerald-200 shadow-md shadow-emerald-50' : 'border-gray-100 shadow-sm'
    }`}>
      {/* Top accent */}
      {isBest && (
        <div className="bg-emerald-600 px-4 py-2 flex items-center justify-between">
          <span className="text-white text-xs font-black uppercase tracking-widest">Best option</span>
          <span className="text-emerald-200 text-xs font-medium">Recommended</span>
        </div>
      )}

      <div className="p-4">
        {/* Brand + price row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Rank dot */}
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                isBest ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                {rank}
              </div>
              {alt.is_generic && (
                <span className="bg-blue-50 text-blue-600 text-[10px] px-2 py-0.5 rounded-full border border-blue-100 font-semibold">Generic</span>
              )}
              {alt.is_jan_aushadhi && (
                <span className="bg-orange-50 text-orange-600 text-[10px] px-2 py-0.5 rounded-full border border-orange-100 font-semibold">Jan Aushadhi</span>
              )}
            </div>

            <p className="font-black text-gray-900 text-lg leading-tight">{alt.brand_name}</p>
            <p className="text-xs text-gray-400 mt-0.5 font-medium truncate">
              {alt.manufacturer}
              {alt.release_type && alt.release_type !== 'IR' && (
                <span className="ml-1.5 text-amber-600 font-semibold">{alt.release_type}</span>
              )}
            </p>
          </div>

          {/* Price */}
          <div className="text-right shrink-0">
            <p className="text-3xl font-black text-gray-900 leading-none">₹{altPPU.toFixed(2)}</p>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5">per tablet</p>
            <div className="mt-2">
              {isCheaper ? (
                <span className="inline-block bg-emerald-600 text-white text-xs font-black px-3 py-1 rounded-full">
                  Save {pct}%
                </span>
              ) : (
                <span className="inline-block bg-red-50 text-red-500 text-xs font-bold px-3 py-1 rounded-full border border-red-100">
                  +{Math.abs(pct)}% costlier
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Manufacturer + safety verdict row */}
        <div className="flex items-center gap-2 flex-wrap mt-3">
          <ManufacturerBadge alt={alt} />
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${vm.color}`}>
            {vm.icon} {vm.label}
          </span>
        </div>

        {/* Confidence */}
        <div className="mt-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Substitution confidence</p>
          <ConfidenceBar score={alt.confidence_score} />
        </div>

        {/* Why this is safe — collapsible */}
        <SafetyPanel explanation={alt.explanation} verdict={alt.verdict} />

        {/* Flag */}
        <div className="mt-3 flex justify-end">
          {flagged ? (
            <span className="text-[10px] text-red-400 font-medium">🚩 Flagged</span>
          ) : (
            <button
              onClick={onFlag}
              className="text-[11px] text-gray-300 hover:text-red-400 transition-colors py-1 px-2 -mr-1 font-medium"
            >
              🚩 Wrong?
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

type FilterMode = 'cheapest' | 'trusted'

export default function AlternativesTable({ product, alternatives }: Props) {
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
        <p className="text-4xl mb-4">🔍</p>
        <p className="text-gray-700 text-base font-bold">No alternatives found</p>
        <p className="text-gray-400 text-sm mt-1">This may be the only brand in our database for this composition.</p>
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

      {/* Filter toggle */}
      <div className="flex gap-1 p-1 bg-gray-50 border border-gray-100 rounded-xl">
        {(['cheapest', 'trusted'] as FilterMode[]).map(mode => (
          <button
            key={mode}
            onClick={() => setFilterMode(mode)}
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-bold py-2.5 rounded-lg transition-all ${
              filterMode === mode
                ? mode === 'trusted'
                  ? 'bg-white text-emerald-700 shadow-sm border border-emerald-100'
                  : 'bg-white text-gray-900 shadow-sm border border-gray-100'
                : 'text-gray-400'
            }`}
          >
            {mode === 'trusted' && <span>🛡</span>}
            {mode === 'cheapest' ? 'All options' : 'Trusted only'}
          </button>
        ))}
      </div>

      {filterMode === 'trusted' && filteredSafe.length === 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700 font-medium">
          No WHO-GMP certified alternatives found for this composition.
        </div>
      )}

      {visibleSafe.length === 0 && cheaper.length === 0 && (
        <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-5 text-center">
          <p className="text-gray-600 text-sm font-semibold">No cheaper alternatives found.</p>
        </div>
      )}

      {/* Alternative cards */}
      {visibleSafe.map((alt, i) => (
        <AltCard
          key={alt.id}
          alt={alt}
          rank={i + 1}
          isBest={i === 0 && alt.savings_per_unit > 0 && alt.verdict === 'safe'}
          productId={product.id}
          flagged={!!flagged[alt.id]}
          onFlag={() => handleFlag(alt.id)}
        />
      ))}

      {/* Show costlier toggle */}
      {costlier.length > 0 && (
        <button
          onClick={() => setShowCostlier(v => !v)}
          className="w-full text-center text-sm text-gray-400 font-semibold py-3.5 border border-gray-100 rounded-xl bg-white hover:text-gray-600 active:bg-gray-50 transition-colors"
        >
          {showCostlier
            ? `Hide ${costlier.length} more expensive option${costlier.length !== 1 ? 's' : ''} ↑`
            : `Show ${costlier.length} more expensive option${costlier.length !== 1 ? 's' : ''} ↓`}
        </button>
      )}

      {/* Unsafe / do not substitute */}
      {unsafe.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowUnsafe(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 font-bold active:bg-red-100 transition-colors"
          >
            <span>⚠ {unsafe.length} unsafe alternative{unsafe.length !== 1 ? 's' : ''} hidden</span>
            <span>{showUnsafe ? '↑ Hide' : 'Show anyway ↓'}</span>
          </button>

          {showUnsafe && unsafe.map((alt, i) => (
            <AltCard
              key={alt.id}
              alt={alt}
              rank={visibleSafe.length + i + 1}
              isBest={false}
              productId={product.id}
              flagged={!!flagged[alt.id]}
              onFlag={() => handleFlag(alt.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
