'use client'
import { useState, KeyboardEvent, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { SuggestionItem } from '@/app/api/suggest/route'

const QUICK_SEARCHES = ['Dolo 650', 'Augmentin 625', 'Pan 40', 'Glycomet 500 SR', 'Crocin 650']

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

export default function SearchBar({ size }: { size?: 'lg' | 'sm' }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const navigate = (q: string) => {
    if (!q.trim()) return
    setOpen(false)
    setSuggestions([])
    setQuery(q)
    router.push(`/search?q=${encodeURIComponent(q.trim())}`)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchSuggestions = useCallback(
    debounce(async (q: string) => {
      if (q.length < 2) { setSuggestions([]); setOpen(false); setLoading(false); return }

      abortRef.current?.abort()
      abortRef.current = new AbortController()

      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`, {
          signal: abortRef.current.signal,
        })
        const data: SuggestionItem[] = await res.json()
        setSuggestions(data)
        setOpen(data.length > 0)
        setHighlighted(-1)
      } catch {
        // aborted or network error — ignore
      } finally {
        setLoading(false)
      }
    }, 180),
    [],
  )

  const handleChange = (value: string) => {
    setQuery(value)
    setLoading(value.length >= 2)
    if (value.length < 2) { setSuggestions([]); setOpen(false); return }
    fetchSuggestions(value)
  }

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlighted >= 0 && suggestions[highlighted]) {
        navigate(suggestions[highlighted].brand_name)
      } else {
        navigate(query)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const isLg = size === 'lg'

  return (
    <div className="w-full max-w-xl mx-auto" ref={containerRef}>
      {/* Input */}
      <div className="relative">
        <div className={`flex rounded-2xl overflow-visible border bg-white shadow-[0_4px_24px_rgba(0,0,0,0.07)] focus-within:shadow-[0_4px_24px_rgba(16,185,129,0.12)] transition-all duration-200 ${
          open ? 'border-emerald-400 rounded-b-none border-b-0' : 'border-gray-200 focus-within:border-emerald-400'
        }`}>
          {/* Search icon */}
          <div className="flex items-center pl-4 shrink-0">
            {loading ? (
              <svg className="w-4 h-4 text-emerald-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={handleKey}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder={isLg ? 'e.g. Dolo 650, Augmentin 625, Pan 40…' : 'Search medicine…'}
            className={`flex-1 bg-transparent outline-none text-gray-800 placeholder-gray-300 ${
              isLg ? 'px-3 py-4 text-base' : 'px-3 py-3 text-sm'
            }`}
            autoComplete="off"
            spellCheck={false}
          />

          <button
            onClick={() => navigate(query)}
            className={`bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold transition-all duration-150 whitespace-nowrap shrink-0 ${
              isLg ? 'px-6 text-sm' : 'px-4 text-sm'
            } ${open ? 'rounded-tr-2xl' : 'rounded-r-2xl'}`}
          >
            Search
          </button>
        </div>

        {/* Dropdown */}
        {open && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full bg-white border border-emerald-400 border-t-gray-100 rounded-b-2xl shadow-xl z-50 overflow-hidden">
            {suggestions.map((item, i) => (
              <button
                key={item.id}
                onMouseDown={() => navigate(item.brand_name)}
                onMouseEnter={() => setHighlighted(i)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  i === highlighted ? 'bg-emerald-50' : 'hover:bg-gray-50'
                } ${i < suggestions.length - 1 ? 'border-b border-gray-50' : ''}`}
              >
                {/* Icon */}
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 text-sm">
                  💊
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm leading-tight">
                    {item.brand_name}
                  </p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {item.composition_text_raw.length > 50
                      ? item.composition_text_raw.slice(0, 50) + '…'
                      : item.composition_text_raw}
                  </p>
                </div>

                {/* Price */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900">₹{item.price_per_unit.toFixed(2)}</p>
                  <p className="text-[10px] text-gray-400">per tablet</p>
                </div>
              </button>
            ))}

            {/* Search anyway row */}
            <button
              onMouseDown={() => navigate(query)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left border-t border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-emerald-600">
                Search for &ldquo;{query}&rdquo;
              </p>
            </button>
          </div>
        )}
      </div>

      {/* Quick search chips — only when no suggestions showing */}
      {!open && (
        <div className="flex flex-wrap gap-2 justify-center mt-4">
          {QUICK_SEARCHES.map(s => (
            <button
              key={s}
              onClick={() => navigate(s)}
              className="bg-white border border-gray-200 text-gray-500 text-xs font-medium px-3 py-1.5 rounded-full hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 transition-all duration-150"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
