'use client'
import { useState, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'

const QUICK_SEARCHES = ['Dolo 650', 'Augmentin 625 Duo', 'Pan 40', 'Lipitor 10', 'Glycomet 500 SR', 'Crocin 650']

export default function SearchBar({ size }: { size?: 'lg' | 'sm' }) {
  const [query, setQuery] = useState('')
  const router = useRouter()

  const handleSearch = (q?: string) => {
    const term = (q ?? query).trim()
    if (!term) return
    router.push(`/search?q=${encodeURIComponent(term)}`)
  }

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch()
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="flex rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.07)] focus-within:border-emerald-400 focus-within:shadow-[0_4px_24px_rgba(16,185,129,0.1)] transition-all duration-200">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
          placeholder="e.g. Dolo 650, Augmentin 625, Pan 40…"
          className="flex-1 px-5 py-4 text-base text-gray-800 placeholder-gray-300 outline-none bg-transparent"
          autoFocus
        />
        <button
          onClick={() => handleSearch()}
          className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold text-sm px-5 transition-all duration-150 whitespace-nowrap"
        >
          Search →
        </button>
      </div>

      <div className="flex flex-wrap gap-2 justify-center mt-4">
        {QUICK_SEARCHES.map(s => (
          <button
            key={s}
            onClick={() => handleSearch(s)}
            className="bg-white border border-gray-200 text-gray-500 text-xs font-medium px-3 py-1.5 rounded-full hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 transition-all duration-150"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
