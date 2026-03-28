import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import CalculatorInner from './CalculatorInner'

export default function CalculatorPage() {
  return (
    <>
      <Navbar />
      <Suspense>
        <CalculatorInner />
      </Suspense>
    </>
  )
}
