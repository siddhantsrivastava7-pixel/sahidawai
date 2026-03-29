import Navbar from '@/components/Navbar'
import PrescriptionAnalysisPage from './PrescriptionAnalysis'

export const metadata = {
  title: 'Prescription Analysis — SahiDawai',
  description: 'Upload your prescription to get a full breakdown with cheaper alternatives and total savings.',
}

export default function Page() {
  return (
    <>
      <Navbar />
      <PrescriptionAnalysisPage />
    </>
  )
}
