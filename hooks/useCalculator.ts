'use client'
import { useState, useEffect, useCallback } from 'react'
import { Product, Alternative } from '@/types'

export interface CalcEntry {
  product: Product
  cheapestAlt: Alternative | null
  dailyDoses: number   // user-editable
  addedAt: number
}

const KEY = 'sahidawai_calc_v1'

function load(): CalcEntry[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

function save(entries: CalcEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(entries))
}

export function useCalculator() {
  const [entries, setEntries] = useState<CalcEntry[]>([])

  useEffect(() => { setEntries(load()) }, [])

  const add = useCallback((product: Product, cheapestAlt: Alternative | null) => {
    setEntries(prev => {
      if (prev.some(e => e.product.id === product.id)) return prev
      const next = [...prev, { product, cheapestAlt, dailyDoses: 2, addedAt: Date.now() }]
      save(next)
      return next
    })
  }, [])

  const remove = useCallback((productId: string) => {
    setEntries(prev => { const next = prev.filter(e => e.product.id !== productId); save(next); return next })
  }, [])

  const updateDoses = useCallback((productId: string, dailyDoses: number) => {
    setEntries(prev => {
      const next = prev.map(e => e.product.id === productId ? { ...e, dailyDoses } : e)
      save(next)
      return next
    })
  }, [])

  const clear = useCallback(() => { save([]); setEntries([]) }, [])

  const isAdded = useCallback((productId: string) => entries.some(e => e.product.id === productId), [entries])

  return { entries, add, remove, updateDoses, clear, isAdded }
}
