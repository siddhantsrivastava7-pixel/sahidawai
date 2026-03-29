import { Product } from '@/types'

interface Props { product: Product; label?: string }

export default function ProductCard({ product, label = 'SEARCHED' }: Props) {
  const ppu = Number(product.price_per_unit)
  const monthly = (ppu * 60).toFixed(0)
  const hasCritical = product.ingredients?.some(i => i.is_critical)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="h-0.5 bg-gradient-to-r from-emerald-500 to-emerald-400" />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-black text-gray-900 leading-tight tracking-tight">{product.brand_name}</h2>
            <p className="text-sm text-gray-400 mt-1 font-medium">{product.manufacturer}</p>
          </div>
          <span className="bg-rose-50 text-rose-600 text-[10px] font-bold px-2.5 py-1 rounded-lg shrink-0 mt-1 tracking-widest border border-rose-100">
            {label}
          </span>
        </div>

        {/* Composition */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {product.ingredients?.map((ing, i) => (
            <span key={i} className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold px-3 py-1.5 rounded-xl">
              {ing.ingredient} {ing.strength}{ing.unit}
              {ing.is_critical && <span className="ml-1 text-amber-500">⚠</span>}
            </span>
          ))}
          <span className="bg-gray-50 text-gray-500 text-xs px-3 py-1.5 rounded-xl border border-gray-100 capitalize font-medium">
            {product.dosage_form}
          </span>
          {product.release_type && product.release_type !== 'IR' && (
            <span className="bg-amber-50 border border-amber-100 text-amber-700 text-xs px-3 py-1.5 rounded-xl font-semibold">
              {product.release_type}
            </span>
          )}
        </div>

        {/* Critical warning */}
        {hasCritical && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-4 text-sm text-amber-700 leading-relaxed">
            ⚠ Contains a <strong>critical drug</strong> — do not switch without physician guidance.
          </div>
        )}

        {/* Price grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: 'Per tablet', value: `₹${ppu.toFixed(2)}`, sub: 'incl. taxes' },
            { label: 'Est. monthly', value: `₹${monthly}`, sub: '2 tabs/day' },
          ].map(cell => (
            <div key={cell.label} className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mb-1">{cell.label}</p>
              <p className="text-xl font-black text-gray-900">{cell.value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{cell.sub}</p>
            </div>
          ))}
        </div>

        {/* MRP note */}
        <p className="text-xs text-gray-300 mt-3 font-medium">
          MRP ₹{Number(product.mrp).toFixed(2)} · {product.unit_per_pack} tablets per pack
        </p>
      </div>
    </div>
  )
}
