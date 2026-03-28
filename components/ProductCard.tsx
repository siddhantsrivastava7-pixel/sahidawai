import { Product } from '@/types'

interface Props { product: Product; label?: string }

export default function ProductCard({ product, label = 'SEARCHED' }: Props) {
  const ppu = Number(product.price_per_unit)
  const monthly = (ppu * 60).toFixed(2)

  const hasCritical = product.ingredients?.some(i => i.is_critical)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_16px_rgba(0,0,0,0.06)] overflow-hidden">
      {/* Emerald accent line */}
      <div className="h-0.5 bg-gradient-to-r from-emerald-500 to-emerald-400" />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 font-display leading-tight tracking-tight">
              {product.brand_name}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">{product.manufacturer}</p>
          </div>
          <span className="bg-rose-50 text-rose-600 text-[10px] font-bold px-2.5 py-1 rounded-lg shrink-0 mt-1 tracking-widest border border-rose-100">
            {label}
          </span>
        </div>

        {/* Composition tags */}
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          {product.ingredients?.map((ing, i) => (
            <span
              key={i}
              className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-medium px-2.5 py-1 rounded-lg"
            >
              {ing.ingredient} {ing.strength}{ing.unit}
              {ing.is_critical && <span className="ml-1 text-amber-500">⚠</span>}
            </span>
          ))}
          <span className="bg-gray-50 text-gray-500 text-xs px-2.5 py-1 rounded-lg border border-gray-100 capitalize">
            {product.dosage_form}
          </span>
          <span className="bg-amber-50 border border-amber-100 text-amber-700 text-xs px-2.5 py-1 rounded-lg font-semibold">
            {product.release_type}
          </span>
        </div>

        {/* Critical drug warning */}
        {hasCritical && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-2.5 mb-4 text-xs text-amber-700 leading-relaxed">
            ⚠ Contains a <strong>critical drug</strong> — do not switch without physician guidance.
          </div>
        )}

        {/* Price row */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: 'MRP per pack', value: `₹${Number(product.mrp).toFixed(2)}`, sub: `${product.unit_per_pack} tablets` },
            { label: 'Per tablet', value: `₹${ppu.toFixed(2)}`, sub: 'incl. taxes' },
            { label: 'Est. monthly', value: `₹${monthly}`, sub: '2 tabs / day' },
          ].map(cell => (
            <div key={cell.label} className="bg-gray-50/80 rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] text-gray-400 font-medium mb-1 uppercase tracking-wide">{cell.label}</p>
              <p className="text-base font-bold text-gray-900">{cell.value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{cell.sub}</p>
            </div>
          ))}
        </div>

        {/* Canonical key */}
        <div className="mt-4 pt-3.5 border-t border-gray-50">
          <p className="text-[10px] text-gray-300 font-medium tracking-widest uppercase mb-1">Canonical key</p>
          <code className="text-[11px] text-emerald-600 bg-emerald-50/60 px-2 py-0.5 rounded font-mono">
            {product.canonical_key}
          </code>
        </div>
      </div>
    </div>
  )
}
