import { Suspense } from 'react'
import SearchPageInner from './SearchPageInner'

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading...</div>}>
      <SearchPageInner />
    </Suspense>
  )
}