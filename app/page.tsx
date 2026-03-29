import Link from 'next/link'
import Navbar from '@/components/Navbar'
import SearchBar from '@/components/SearchBar'

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <section className="relative px-4 pt-14 pb-12 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(16,185,129,0.07),transparent)]" />

        <div className="relative max-w-lg mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-bold px-3.5 py-2 rounded-full border border-emerald-100 mb-6 tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            🇮🇳 Built for India · CDSCO-aligned Data
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 leading-[1.1] tracking-tight mb-4">
            Same medicine.<br />
            <span className="text-emerald-600">Lower price.</span>
          </h1>

          <p className="text-gray-500 text-base sm:text-lg max-w-sm mx-auto mb-8 leading-relaxed">
            Search any brand name. We find the exact same salt composition at a fraction of the cost.
          </p>

          {/* Search */}
          <SearchBar size="lg" />

          {/* Prescription CTA */}
          <div className="mt-5">
            <Link
              href="/prescription"
              className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-bold px-5 py-3 rounded-xl hover:bg-gray-800 active:scale-95 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Scan full prescription
            </Link>
            <p className="text-gray-400 text-xs mt-2">Upload a photo · get monthly savings in seconds</p>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="max-w-lg mx-auto px-4 pb-10">
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: '💊', title: 'Same salt', desc: 'Exact composition match, not just similar' },
            { icon: '🛡', title: 'Safety first', desc: 'NTI drugs, release type, and dosage checks' },
            { icon: '💰', title: 'Real savings', desc: 'Monthly cost shown upfront' },
          ].map(item => (
            <div key={item.title} className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-center">
              <p className="text-2xl mb-2">{item.icon}</p>
              <p className="text-xs font-bold text-gray-800 mb-1">{item.title}</p>
              <p className="text-[11px] text-gray-400 leading-snug">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-lg mx-auto px-4 pb-14">
        <p className="text-[10px] font-bold tracking-[0.2em] text-gray-400 uppercase mb-4">How it works</p>
        <div className="space-y-3">
          {[
            { step: '1', icon: '🔍', title: 'Search your medicine', desc: 'Type any brand name — Dolo 650, Augmentin 625, Pan 40' },
            { step: '2', icon: '⚗️', title: 'We match the salt', desc: 'Exact composition match with same strength, dose form, and release type' },
            { step: '3', icon: '💰', title: 'See ranked savings', desc: 'All alternatives sorted by price per tablet with safety verdict' },
          ].map(item => (
            <div key={item.step} className="flex items-start gap-4 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center text-lg shrink-0">
                {item.icon}
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm mb-0.5">{item.title}</p>
                <p className="text-xs text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 text-center py-7 px-4">
        <p className="text-gray-400 text-xs font-medium">MyDawai — Empowering patients with price transparency</p>
        <p className="text-gray-300 text-xs mt-1.5">Not a substitute for medical advice · Always consult your pharmacist</p>
      </footer>
    </div>
  )
}
