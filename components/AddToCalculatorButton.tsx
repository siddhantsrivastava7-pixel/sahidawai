'use client'
import { useCalculator } from '@/hooks/useCalculator'
import { Product, Alternative } from '@/types'
import { useRouter } from 'next/navigation'

interface Props {
  product: Product
  cheapestAlt: Alternative | null
}

export default function AddToCalculatorButton({ product, cheapestAlt }: Props) {
  const { add, isAdded } = useCalculator()
  const router = useRouter()
  const added = isAdded(product.id)

  if (added) {
    return (
      <button
        onClick={() => router.push('/calculator')}
        className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 text-xs font-semibold px-3.5 py-2 rounded-xl hover:bg-emerald-100 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        View in calculator →
      </button>
    )
  }

  return (
    <button
      onClick={() => add(product, cheapestAlt)}
      className="flex items-center gap-1.5 text-gray-500 bg-white border border-gray-200 text-xs font-semibold px-3.5 py-2 rounded-xl hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
      Add to savings calculator
    </button>
  )
}
