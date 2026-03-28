'use client'
import { useCalculator, CalcEntry } from '@/hooks/useCalculator'
import { useRouter } from 'next/navigation'

function monthlyCost(pricePerUnit: number, dailyDoses: number) {
  return pricePerUnit * dailyDoses * 30
}

function EntryRow({ entry, onRemove, onDoseChange }: {
  entry: CalcEntry
  onRemove: () => void
  onDoseChange: (d: number) => void
}) {
  const currentMonthly = monthlyCost(Number(entry.product.price_per_unit), entry.dailyDoses)
  const altMonthly = entry.cheapestAlt
    ? monthlyCost(Number(entry.cheapestAlt.price_per_unit), entry.dailyDoses)
    : null
  const saving = altMonthly !== null ? currentMonthly - altMonthly : 0
  const hasSaving = saving > 0.01

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_6px_rgba(0,0,0,0.04)] p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-semibold text-gray-900 text-sm">{entry.product.brand_name}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{entry.product.manufacturer} · {entry.product.composition_text_raw}</p>
        </div>
        <button onClick={onRemove} className="text-gray-300 hover:text-red-400 transition-colors mt-0.5 shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {/* Daily doses input */}
        <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1.5">Daily doses</p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onDoseChange(Math.max(1, entry.dailyDoses - 1))}
              className="w-5 h-5 rounded-full bg-white border border-gray-200 text-gray-500 text-xs font-bold hover:border-emerald-300 hover:text-emerald-600 transition-colors flex items-center justify-center"
            >−</button>
            <span className="text-sm font-bold text-gray-900 w-4 text-center">{entry.dailyDoses}</span>
            <button
              onClick={() => onDoseChange(Math.min(10, entry.dailyDoses + 1))}
              className="w-5 h-5 rounded-full bg-white border border-gray-200 text-gray-500 text-xs font-bold hover:border-emerald-300 hover:text-emerald-600 transition-colors flex items-center justify-center"
            >+</button>
          </div>
        </div>

        {/* Current cost */}
        <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1">Current/mo</p>
          <p className="text-sm font-bold text-gray-900">₹{currentMonthly.toFixed(0)}</p>
          <p className="text-[10px] text-gray-400">₹{Number(entry.product.price_per_unit).toFixed(2)}/tab</p>
        </div>

        {/* With alternative */}
        <div className={`rounded-xl p-2.5 border ${hasSaving ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-100'}`}>
          <p className={`text-[10px] font-medium uppercase tracking-wide mb-1 ${hasSaving ? 'text-emerald-600' : 'text-gray-400'}`}>
            Cheapest alt/mo
          </p>
          {entry.cheapestAlt ? (
            <>
              <p className={`text-sm font-bold ${hasSaving ? 'text-emerald-700' : 'text-gray-900'}`}>
                ₹{altMonthly!.toFixed(0)}
              </p>
              <p className={`text-[10px] ${hasSaving ? 'text-emerald-600' : 'text-gray-400'}`}>
                {entry.cheapestAlt.brand_name}
              </p>
            </>
          ) : (
            <p className="text-[11px] text-gray-400">No alt found</p>
          )}
        </div>
      </div>

      {hasSaving && (
        <div className="flex items-center justify-between bg-emerald-600 rounded-xl px-3.5 py-2.5">
          <p className="text-emerald-100 text-xs font-medium">Save by switching</p>
          <div className="text-right">
            <span className="text-white text-sm font-black">₹{saving.toFixed(0)}/mo</span>
            <span className="text-emerald-300 text-xs ml-1.5">·</span>
            <span className="text-emerald-200 text-xs ml-1.5">₹{(saving * 12).toFixed(0)}/yr</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CalculatorInner() {
  const { entries, remove, updateDoses, clear } = useCalculator()
  const router = useRouter()

  const totalCurrentMonthly = entries.reduce((sum, e) =>
    sum + monthlyCost(Number(e.product.price_per_unit), e.dailyDoses), 0)

  const totalAltMonthly = entries.reduce((sum, e) => {
    if (!e.cheapestAlt) return sum + monthlyCost(Number(e.product.price_per_unit), e.dailyDoses)
    const alt = monthlyCost(Number(e.cheapestAlt.price_per_unit), e.dailyDoses)
    const curr = monthlyCost(Number(e.product.price_per_unit), e.dailyDoses)
    return sum + Math.min(alt, curr)
  }, 0)

  const totalSaving = totalCurrentMonthly - totalAltMonthly
  const savingPct = totalCurrentMonthly > 0 ? (totalSaving / totalCurrentMonthly * 100) : 0

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Savings Calculator</h1>
          <p className="text-sm text-gray-400 mt-0.5">Monthly cost of your chronic medications</p>
        </div>
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-gray-400 text-sm font-medium hover:text-emerald-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add medicine
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-gray-100">
            <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-gray-700 mb-2">No medicines added yet</h2>
          <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto">
            Search for a medicine and click <strong className="text-gray-600">"Add to savings calculator"</strong> to track your monthly spend.
          </p>
          <button
            onClick={() => router.push('/')}
            className="bg-emerald-600 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors text-sm"
          >
            Search medicines
          </button>
        </div>
      ) : (
        <>
          {/* Summary banner */}
          {totalSaving > 0.5 && (
            <div className="relative bg-gradient-to-br from-emerald-700 to-emerald-500 rounded-2xl p-5 mb-5 overflow-hidden">
              <div
                className="absolute inset-0 opacity-[0.07]"
                style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '18px 18px' }}
              />
              <div className="relative flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-emerald-200 text-xs font-medium tracking-wide uppercase mb-1">Total you could save</p>
                  <p className="text-white text-3xl font-black tracking-tight">
                    ₹{totalSaving.toFixed(0)}<span className="text-lg font-semibold text-emerald-200"> / month</span>
                  </p>
                  <p className="text-emerald-300 text-xs mt-1">₹{(totalSaving * 12).toFixed(0)} per year · {savingPct.toFixed(0)}% less</p>
                </div>
                <div className="text-right">
                  <p className="text-emerald-200 text-xs font-medium mb-0.5">Current spend</p>
                  <p className="text-white text-lg font-bold">₹{totalCurrentMonthly.toFixed(0)}/mo</p>
                  <p className="text-emerald-200 text-xs mt-0.5">With generics: ₹{totalAltMonthly.toFixed(0)}/mo</p>
                </div>
              </div>
            </div>
          )}

          {totalSaving <= 0.5 && entries.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3.5 text-sm text-amber-700 font-medium mb-5">
              ✓ You&apos;re already on the cheapest options for all your medicines.
            </div>
          )}

          {/* Medicine list */}
          <div className="space-y-3 mb-5">
            {entries.map(entry => (
              <EntryRow
                key={entry.product.id}
                entry={entry}
                onRemove={() => remove(entry.product.id)}
                onDoseChange={d => updateDoses(entry.product.id, d)}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <button
              onClick={clear}
              className="text-gray-300 text-xs hover:text-red-400 transition-colors"
            >
              Clear all
            </button>
            <p className="text-[10px] text-gray-300">
              {entries.length} medicine{entries.length !== 1 ? 's' : ''} · adjust doses per your prescription
            </p>
          </div>

          <div className="mt-5 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs text-gray-400 leading-relaxed">
            <strong className="text-gray-500">Disclaimer:</strong> Switch medicines only under pharmacist or physician supervision.
            Prices are indicative MRP; actual retail prices may vary.
          </div>
        </>
      )}
    </main>
  )
}
