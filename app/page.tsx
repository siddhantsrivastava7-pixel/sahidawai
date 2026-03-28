import Navbar from '@/components/Navbar'
import SearchBar from '@/components/SearchBar'
import PrescriptionUpload from '@/components/PrescriptionUpload'

const HOW_IT_WORKS = [
  { icon: '⚗️', title: 'Parse composition', desc: 'We extract salt name, strength, unit, dosage form and release type from the brand name.' },
  { icon: '🔄', title: 'Normalize synonyms', desc: 'Acetaminophen = Paracetamol. All brand & generic synonyms are mapped to one canonical name.' },
  { icon: '🔑', title: 'Match canonically', desc: 'We generate a deterministic key like paracetamol|650mg|tablet|IR for exact matching.' },
  { icon: '💰', title: 'Rank by ₹/tablet', desc: 'All alternatives sorted by price per unit. Monthly savings shown upfront.' },
]

const TRUST_ITEMS = [
  'Salt-level matching',
  'Release-type aware (SR/ER/EC)',
  'Price per tablet shown',
  'Jan Aushadhi coming soon',
]

export default function Home() {
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-20 pb-16 px-4 text-center overflow-hidden">
        {/* Subtle radial background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(16,185,129,0.08),transparent)]" />

        <div className="relative max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-emerald-100 mb-7 tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            🇮🇳 Built for India · CDSCO-aligned Data
          </div>

          <h1 className="font-display text-5xl sm:text-6xl font-extrabold text-gray-900 leading-[1.1] tracking-tight mb-5">
            Find cheaper medicines<br />
            with the{' '}
            <span className="text-emerald-600">same salt</span>
          </h1>

          <p className="text-gray-500 text-base sm:text-lg max-w-md mx-auto mb-10 leading-relaxed">
            Search any brand name. We show you exact composition matches
            ranked by price — so you never overpay for the same drug.
          </p>

          <SearchBar size="lg" />
          <PrescriptionUpload />

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-9">
            {TRUST_ITEMS.map(t => (
              <div key={t} className="flex items-center gap-2 text-gray-400 text-xs font-medium">
                <div className="w-1 h-1 rounded-full bg-emerald-400" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="border-t border-gray-100" />
      </div>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-4 py-14">
        <p className="text-[10px] font-bold tracking-[0.2em] text-gray-400 uppercase mb-6">
          How SahiDawai works
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {HOW_IT_WORKS.map((item, i) => (
            <div
              key={item.title}
              className="group bg-white border border-gray-100 rounded-2xl p-5 hover:border-emerald-200 hover:shadow-md hover:shadow-emerald-50 transition-all duration-200"
            >
              <div className="w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center text-lg mb-4 group-hover:bg-emerald-50 transition-colors">
                {item.icon}
              </div>
              <div className="text-[10px] font-bold tracking-widest text-gray-300 uppercase mb-1">
                Step {i + 1}
              </div>
              <div className="font-semibold text-gray-900 text-sm mb-1.5">{item.title}</div>
              <div className="text-gray-400 text-xs leading-relaxed">{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 text-center py-7 px-4 mt-4">
        <p className="text-gray-400 text-xs font-medium">
          SahiDawai — Empowering patients with price transparency
        </p>
        <p className="text-gray-300 text-xs mt-1.5">
          Not a substitute for medical advice · Jan Aushadhi integration · Manufacturer trust scores — coming soon
        </p>
      </footer>
    </div>
  )
}
