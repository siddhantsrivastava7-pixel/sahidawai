'use client'
import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { SearchResult } from '@/types'
import ProductCard from '@/components/ProductCard'
import AlternativesTable from '@/components/AlternativesTable'
import SearchBar from '@/components/SearchBar'
import AddToCalculatorButton from '@/components/AddToCalculatorButton'

type DiscoverStatus = 'idle' | 'searching' | 'done' | 'failed'

export default function SearchPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const query = searchParams.get('q') ?? ''
  const [result, setResult] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [discoverStatus, setDiscoverStatus] = useState<DiscoverStatus>('idle')
  const sessionId = useRef(Math.random().toString(36).slice(2))

  const runSearch = async (q: string) => {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, session_id: sessionId.current }),
    })
    return res.json() as Promise<SearchResult>
  }

  useEffect(() => {
    if (!query) return
    setLoading(true)
    setResult(null)
    setDiscoverStatus('idle')

    runSearch(query)
      .then(async data => {
        if (data.found) {
          setResult(data)
          setLoading(false)
          return
        }

        setLoading(false)
        setDiscoverStatus('searching')

        try {
          const discRes = await fetch('/api/discover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, session_id: sessionId.current }),
          })
          const discData = await discRes.json()

          if (discData.found === false) {
            setDiscoverStatus('failed')
            setResult(data)
            return
          }

          const fresh = await runSearch(query)
          setResult(fresh)
          setDiscoverStatus('done')
        } catch {
          setDiscoverStatus('failed')
          setResult(data)
        }
      })
      .catch(() => {
        setResult({ found: false, query })
        setLoading(false)
      })
  }, [query])

  return (
    <main className="max-w-lg mx-auto px-4 py-6 pb-16">
      {/* Search bar */}
      <div className="mb-6">
        <SearchBar />
      </div>

      {/* Skeleton */}
      {loading && (
        <div className="space-y-3 animate-pulse">
          <div className="h-48 bg-white rounded-2xl border border-gray-100" />
          <div className="h-24 bg-emerald-50 rounded-2xl" />
          <div className="h-20 bg-white rounded-2xl border border-gray-100" />
          <div className="h-20 bg-white rounded-2xl border border-gray-100" />
          <div className="h-20 bg-white rounded-2xl border border-gray-100" />
        </div>
      )}

      {/* Discovering */}
      {discoverStatus === 'searching' && (
        <div className="text-center py-20">
          <div className="flex items-center justify-center gap-2 mb-5">
            {[0, 1, 2].map(i => (
              <span key={i} className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <p className="text-base font-bold text-gray-800 mb-1">Searching pharmacies…</p>
          <p className="text-sm text-gray-400 max-w-xs mx-auto leading-relaxed">
            <strong className="text-gray-600">&ldquo;{query}&rdquo;</strong> isn&apos;t in our database yet.
            Fetching from 1mg and adding it now.
          </p>
        </div>
      )}

      {/* Just added */}
      {discoverStatus === 'done' && result?.found && (
        <div className="mb-4 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-sm text-emerald-700 font-semibold flex items-center gap-2">
          <span>✓</span> Added to our database — future searches will be instant.
        </div>
      )}

      {/* Not found */}
      {discoverStatus === 'failed' && (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-gray-100 text-3xl">💊</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2 tracking-tight">Not found anywhere</h2>
          <p className="text-gray-400 text-sm mb-7 max-w-xs mx-auto leading-relaxed">
            We searched our database and 1mg but couldn&apos;t find{' '}
            <strong className="text-gray-600">&ldquo;{query}&rdquo;</strong>.
            Try the brand name or check the spelling.
          </p>
          <button
            onClick={() => router.push('/')}
            className="bg-emerald-600 text-white font-bold px-6 py-3.5 rounded-xl text-sm active:bg-emerald-700"
          >
            ← Back to search
          </button>
        </div>
      )}

      {/* Results */}
      {!loading && discoverStatus !== 'searching' && result?.found && result.product && (
        <div className="space-y-5">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 text-gray-400 text-sm font-semibold hover:text-emerald-600 transition-colors py-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Search again
          </button>

          {/* Product card */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold tracking-[0.2em] text-gray-300 uppercase">Your medicine</p>
              <AddToCalculatorButton
                product={result.product}
                cheapestAlt={result.alternatives?.find(a => a.is_safe_substitute && a.savings_per_unit > 0) ?? result.alternatives?.[0] ?? null}
              />
            </div>
            <ProductCard product={result.product} />
          </div>

          {/* Alternatives */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold tracking-[0.2em] text-gray-300 uppercase">Cheaper alternatives</p>
              <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-100">
                {result.alternatives?.length ?? 0} found
              </span>
            </div>
            <AlternativesTable
              product={result.product}
              alternatives={result.alternatives ?? []}
              savings={result.savings ?? null}
            />
          </div>

          <p className="text-xs text-gray-400 leading-relaxed pt-1 border-t border-gray-100">
            <strong className="text-gray-500">Disclaimer:</strong> Bioavailability and quality may differ across manufacturers.
            Always switch under pharmacist or physician supervision.
          </p>
        </div>
      )}
    </main>
  )
}
