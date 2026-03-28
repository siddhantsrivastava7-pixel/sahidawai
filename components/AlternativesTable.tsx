import { Alternative, Product, Savings } from '@/types'

interface Props {
  product: Product
  alternatives: Alternative[]
  savings: Savings | null
}

export default function AlternativesTable({ alternatives, savings }: Props) {
  if (!alternatives.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <div className="text-3xl mb-3">🏷️</div>
        <p className="text-gray-500 text-sm font-medium">No alternatives found for this composition.</p>
        <p className="text-gray-300 text-xs mt-1">This may be the only brand in our database.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {/* Savings banner */}
      {savings ? (
        <div className="relative bg-gradient-to-br from-emerald-700 to-emerald-500 rounded-2xl p-5 overflow-hidden">
          {/* Subtle dot pattern */}
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

      {/* Alternatives list */}
      {alternatives.map((alt, i) => {
        const altPPU = Number(alt.price_per_unit)
        const isCheaper = alt.savings_per_unit > 0
        const isBest = i === 0 && isCheaper
        const pct = Number(alt.savings_pct)

        return (
          <div
            key={alt.id}
            className={`bg-white rounded-2xl border p-4 flex items-center gap-4 transition-all duration-150 hover:shadow-md
              ${isBest
                ? 'border-emerald-200 shadow-[0_2px_12px_rgba(16,185,129,0.08)]'
                : 'border-gray-100 shadow-[0_1px_4px_rgba(0,0,0,0.04)]'
              }`}
          >
            {/* Rank */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0
              ${i === 0 && isCheaper ? 'bg-emerald-600 text-white' : i < 3 ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400'}`}>
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
              <p className="text-[11px] text-gray-400 mt-0.5 font-medium">{alt.manufacturer} · {alt.unit_per_pack} tabs · MRP ₹{Number(alt.mrp).toFixed(2)}</p>
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
            </div>
          </div>
        )
      })}
    </div>
  )
}
