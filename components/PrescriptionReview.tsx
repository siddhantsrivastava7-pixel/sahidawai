'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { OcrCandidate, OcrGuess } from '@/app/api/ocr-extract/route'
import { SuggestionItem } from '@/app/api/suggest/route'

// ── Types ─────────────────────────────────────────────────────────────────

export interface ConfirmedMedicine {
  name: string
  frequency_label: string
  tabs_per_day: number
  duration_days: number
}

interface ReviewItem {
  uid: string
  ocr_text: string
  confidence: number
  // user-editable fields
  name: string
  frequency_label: string
  tabs_per_day: number
  duration_days: number
  // guesses from DB
  guesses: OcrGuess[]
  // UI state
  editing: boolean
}

interface Props {
  candidates: OcrCandidate[]
  sessionId: string
  onConfirm: (medicines: ConfirmedMedicine[], corrections: CorrectionRecord[]) => void
}

export interface CorrectionRecord {
  ocr_text: string
  corrected_name: string
  confidence: number
  was_changed: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2) }

function confidenceColor(c: number) {
  if (c >= 0.75) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (c >= 0.5)  return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-red-50 text-red-600 border-red-200'
}

function confidenceLabel(c: number) {
  if (c >= 0.75) return 'Clear'
  if (c >= 0.5)  return 'Uncertain'
  return 'Hard to read'
}

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
  let t: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms) }
}

// ── Search input with suggest dropdown ────────────────────────────────────

function MedicineSearch({
  value,
  onChange,
  onSelect,
}: {
  value: string
  onChange: (v: string) => void
  onSelect: (name: string) => void
}) {
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchSuggestions = useCallback(
    debounce(async (q: string) => {
      if (q.length < 2) { setSuggestions([]); setOpen(false); return }
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`)
        const data: SuggestionItem[] = await res.json()
        setSuggestions(data)
        setOpen(data.length > 0)
      } catch { /* ignore */ }
    }, 200),
    [],
  )

  const handleChange = (v: string) => {
    onChange(v)
    fetchSuggestions(v)
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <input
        autoFocus
        type="text"
        value={value}
        onChange={e => handleChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && value.trim()) { onSelect(value.trim()); setOpen(false) } }}
        placeholder="Type medicine name…"
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400 bg-white"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          {suggestions.map(s => (
            <button
              key={s.id}
              onMouseDown={() => { onSelect(s.brand_name); setOpen(false) }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-emerald-50 border-b border-gray-50 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{s.brand_name}</p>
                <p className="text-[11px] text-gray-400 truncate">{s.composition_text_raw} · {s.unit_per_pack} units</p>
              </div>
              <p className="text-xs font-bold text-gray-500 shrink-0">₹{s.price_per_unit.toFixed(2)}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Single review row ─────────────────────────────────────────────────────

function ReviewRow({
  item,
  onUpdate,
  onDelete,
}: {
  item: ReviewItem
  onUpdate: (uid: string, patch: Partial<ReviewItem>) => void
  onDelete: (uid: string) => void
}) {
  const [searchValue, setSearchValue] = useState(item.name)

  const setEditing = (v: boolean) => onUpdate(item.uid, { editing: v })

  const selectName = (name: string) => {
    onUpdate(item.uid, { name, editing: false })
    setSearchValue(name)
  }

  const isUncertain = item.confidence < 0.75

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden ${isUncertain ? 'border-amber-100' : 'border-gray-100'}`}>
      {/* Header bar */}
      <div className={`px-4 py-2 flex items-center justify-between ${isUncertain ? 'bg-amber-50' : 'bg-gray-50'}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${confidenceColor(item.confidence)}`}>
            {confidenceLabel(item.confidence)}
          </span>
          {item.ocr_text !== item.name && (
            <span className="text-[11px] text-gray-400 truncate">
              Read as: &ldquo;{item.ocr_text}&rdquo;
            </span>
          )}
        </div>
        <button
          onClick={() => onDelete(item.uid)}
          className="text-gray-300 hover:text-red-400 transition-colors ml-2 shrink-0 p-1"
          title="Remove"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Medicine name */}
        {item.editing ? (
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Search for correct medicine</p>
            <MedicineSearch
              value={searchValue}
              onChange={setSearchValue}
              onSelect={selectName}
            />
            {/* DB guesses */}
            {item.guesses.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Or pick from suggestions</p>
                {item.guesses.map(g => (
                  <button
                    key={g.id}
                    onClick={() => selectName(g.brand_name)}
                    className="w-full flex items-center gap-3 bg-gray-50 hover:bg-emerald-50 border border-gray-100 hover:border-emerald-200 rounded-xl px-3 py-2.5 text-left transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{g.brand_name}</p>
                      <p className="text-[11px] text-gray-400 truncate">{g.manufacturer}</p>
                    </div>
                    <p className="text-xs font-bold text-gray-500 shrink-0">₹{g.price_per_unit.toFixed(2)}/tab</p>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setEditing(false)} className="text-xs text-gray-400 font-semibold hover:text-gray-600">
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-base leading-tight">{item.name}</p>
            </div>
            <button
              onClick={() => { setSearchValue(item.name); setEditing(true) }}
              className="shrink-0 text-xs text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              Change
            </button>
          </div>
        )}

        {/* Dosage row — always editable */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Times/day</label>
            <input
              type="number"
              min={1}
              max={6}
              value={item.tabs_per_day}
              onChange={e => onUpdate(item.uid, { tabs_per_day: Math.max(1, parseInt(e.target.value) || 1) })}
              className="w-10 text-sm font-bold text-gray-900 bg-transparent outline-none text-center"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Days</label>
            <input
              type="number"
              min={1}
              max={365}
              value={item.duration_days}
              onChange={e => onUpdate(item.uid, { duration_days: Math.max(1, parseInt(e.target.value) || 1) })}
              className="w-12 text-sm font-bold text-gray-900 bg-transparent outline-none text-center"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5">
            <input
              type="text"
              value={item.frequency_label}
              onChange={e => onUpdate(item.uid, { frequency_label: e.target.value })}
              placeholder="e.g. twice daily"
              className="text-xs text-gray-600 bg-transparent outline-none w-28"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function PrescriptionReview({ candidates, sessionId, onConfirm }: Props) {
  const [items, setItems] = useState<ReviewItem[]>(() =>
    candidates.map(c => ({
      uid: uid(),
      ocr_text: c.ocr_text,
      confidence: c.confidence,
      name: c.guesses[0]?.brand_name ?? c.probable_name,
      frequency_label: c.frequency_label,
      tabs_per_day: c.tabs_per_day,
      duration_days: c.duration_days,
      guesses: c.guesses,
      editing: false,
    }))
  )

  const update = (id: string, patch: Partial<ReviewItem>) =>
    setItems(prev => prev.map(it => it.uid === id ? { ...it, ...patch } : it))

  const remove = (id: string) =>
    setItems(prev => prev.filter(it => it.uid !== id))

  const addBlank = () =>
    setItems(prev => [...prev, {
      uid: uid(),
      ocr_text: '',
      confidence: 1,
      name: '',
      frequency_label: 'once daily',
      tabs_per_day: 1,
      duration_days: 7,
      guesses: [],
      editing: true,
    }])

  const handleConfirm = () => {
    const valid = items.filter(it => it.name.trim())
    if (!valid.length) return

    const medicines: ConfirmedMedicine[] = valid.map(it => ({
      name: it.name.trim(),
      frequency_label: it.frequency_label,
      tabs_per_day: it.tabs_per_day,
      duration_days: it.duration_days,
    }))

    // Build correction records for feedback
    const corrections: CorrectionRecord[] = valid.map((it, i) => {
      const original = candidates[i]
      const originalName = original?.guesses[0]?.brand_name ?? original?.probable_name ?? ''
      return {
        ocr_text: it.ocr_text,
        corrected_name: it.name.trim(),
        confidence: it.confidence,
        was_changed: it.name.trim() !== originalName,
      }
    })

    onConfirm(medicines, corrections)
  }

  const uncertain = items.filter(it => it.confidence < 0.75)
  const allValid = items.every(it => it.name.trim())

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Review medicines</h2>
        <p className="text-sm text-gray-400 mt-1">
          We found {items.length} medicine{items.length !== 1 ? 's' : ''}.
          {uncertain.length > 0 && (
            <span className="text-amber-600 font-semibold"> {uncertain.length} need{uncertain.length === 1 ? 's' : ''} your attention.</span>
          )}
        </p>
      </div>

      {/* Uncertain warning */}
      {uncertain.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-lg shrink-0 mt-0.5">⚠️</span>
          <p className="text-sm text-amber-700">
            <strong>Handwriting was unclear</strong> for {uncertain.length} medicine{uncertain.length !== 1 ? 's' : ''}.
            Please verify the names below are correct before continuing.
          </p>
        </div>
      )}

      {/* Items */}
      {items.map(item => (
        <ReviewRow key={item.uid} item={item} onUpdate={update} onDelete={remove} />
      ))}

      {/* Add medicine */}
      <button
        onClick={addBlank}
        className="w-full flex items-center justify-center gap-2 py-3.5 border-2 border-dashed border-gray-200 rounded-2xl text-sm font-semibold text-gray-400 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50/30 transition-all"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add medicine
      </button>

      {/* Confirm CTA */}
      <button
        onClick={handleConfirm}
        disabled={!allValid || items.length === 0}
        className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl text-base disabled:opacity-40 active:bg-emerald-700 transition-colors shadow-sm shadow-emerald-200"
      >
        Find savings for {items.filter(it => it.name.trim()).length} medicine{items.filter(it => it.name.trim()).length !== 1 ? 's' : ''} →
      </button>

      <p className="text-xs text-gray-400 text-center">
        We won&apos;t run any analysis until you tap the button above.
      </p>
    </div>
  )
}
