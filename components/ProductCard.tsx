import { Product } from '@/types'

interface Props { product: Product; label?: string }

export default function ProductCard({ product }: Props) {
  const ppu = Number(product.price_per_unit)
  const hasCritical = product.ingredients?.some(i => i.is_critical)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4">
        {/* Name + price on one line */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-black text-gray-900 leading-tight tracking-tight">{product.brand_name}</h2>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">{product.manufacturer}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-black text-gray-900 leading-none">₹{ppu.toFixed(2)}</p>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5">per tablet</p>
          </div>
        </div>

        {/* Composition pills */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {product.ingredients?.map((ing, i) => (
            <span key={i} className="bg-gray-50 border border-gray-100 text-gray-600 text-xs font-medium px-2.5 py-1 rounded-lg">
              {ing.ingredient} {ing.strength}{ing.unit}
              {ing.is_critical && <span className="ml-1 text-amber-500">⚠</span>}
            </span>
          ))}
          <span className="bg-gray-50 text-gray-400 text-xs px-2.5 py-1 rounded-lg border border-gray-100 capitalize">
            {product.dosage_form}
          </span>
          {product.release_type && product.release_type !== 'IR' && (
            <span className="bg-amber-50 border border-amber-100 text-amber-700 text-xs px-2.5 py-1 rounded-lg font-semibold">
              {product.release_type}
            </span>
          )}
        </div>

        {/* Critical warning */}
        {hasCritical && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-2.5 mt-3 text-xs text-amber-700 leading-relaxed">
            ⚠ Contains a <strong>critical drug</strong> — do not switch without physician guidance.
          </div>
        )}
      </div>
    </div>
  )
}
