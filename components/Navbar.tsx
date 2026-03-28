import Link from 'next/link'

export default function Navbar() {
  return (
    <nav className="bg-white/90 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50 px-5 h-14 flex items-center gap-3">
      <Link href="/" className="flex items-center gap-2.5">
        <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center shadow-sm shadow-emerald-200">
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
        <span className="text-gray-900 font-bold text-base tracking-tight">SahiDawai</span>
        <span className="bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-emerald-100 tracking-wide">
          BETA
        </span>
      </Link>
      <div className="ml-auto flex items-center gap-3">
        <Link
          href="/calculator"
          className="flex items-center gap-1.5 text-gray-500 text-xs font-medium hover:text-emerald-600 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="hidden sm:inline">Calculator</span>
        </Link>
        <span className="text-gray-200 hidden sm:block">|</span>
        <span className="text-gray-400 text-xs hidden sm:block tracking-wide">Same salt. Better price.</span>
      </div>
    </nav>
  )
}
