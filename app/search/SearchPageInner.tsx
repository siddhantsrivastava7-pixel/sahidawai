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

        // Not in DB — try discovering from 1mg
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

          // Newly inserted — re-run search to get full result with alternatives
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
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-7"><SearchBar /></div>

      {/* Skeleton */}
      {loading && (
        <div className="space-y-3 animate-pulse">
          <div className="h-52 bg-gray-50 rounded-2xl border border-gray-100" />
          <div className="h-28 bg-emerald-50 rounded-2xl" />
          <div className="h-16 bg-gray-50 rounded-2xl border border-gray-100" />
          <div className="h-16 bg-gray-50 rounded-2xl border border-gray-100" />
          <div className="h-16 bg-gray-50 rounded-2xl border border-gray-100" />
        </div>
      )}

      {/* Discovering from pharmacies */}
      {discoverStatus === 'searching' && (
        <div className="text-center py-20">
          <div className="flex items-center justify-center gap-1.5 mb-5">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <h2 className="text-base font-semibold text-gray-700 mb-1">Searching pharmacies for you…</h2>
          <p className="text-gray-400 text-xs max-w-xs mx-auto">
            <strong className="text-gray-500">&quot;{query}&quot;</strong> isn&apos;t in our database yet.
            We&apos;re fetching it from 1mg and adding it now.
          </p>
        </div>
      )}

      {/* Discover succeeded — flash a "just added" note before showing results */}
      {discoverStatus === 'done' && result?.found && (
        <div className="mb-4 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5 text-xs text-emerald-700 font-medium">
          ✓ Added to our database — future searches will be instant.
        </div>
      )}

      {/* Not found even after discover */}
      {discoverStatus === 'failed' && (
        <div className="text-center py-20">
          <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-gray-100">
            <span className="text-2xl">💊</span>
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-2 tracking-tight">Not found anywhere</h2>
          <p className="text-gray-400 text-sm mb-7 max-w-xs mx-auto leading-relaxed">
            We searched our database and 1mg but couldn&apos;t find <strong className="text-gray-600">&quot;{query}&quot;</strong>.
            Try the brand name or check the spelling.
          </p>
          <button
            onClick={() => router.push('/')}
            className="bg-emerald-600 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors text-sm"
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
            className="flex items-center gap-1.5 text-gray-400 text-sm font-medium hover:text-emerald-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Search again
          </button>

          <div>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold tracking-[0.2em] text-gray-300 uppercase">Searched Medicine</p>
              <AddToCalculatorButton
                product={result.product}
                cheapestAlt={result.alternatives?.find(a => a.is_safe_substitute && a.savings_per_unit > 0) ?? result.alternatives?.[0] ?? null}
              />
            </div>
            <ProductCard product={result.product} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold tracking-[0.2em] text-gray-300 uppercase">Cheaper Alternatives</p>
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

          <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs text-gray-400 leading-relaxed">
            <strong className="text-gray-500">Disclaimer:</strong> Bioavailability, excipients, and quality may differ across manufacturers.
            Always switch medicines under pharmacist or physician supervision.
          </div>
        </div>
      )}
    </main>
  )
}
