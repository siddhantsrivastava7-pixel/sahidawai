export default function SafetyBanner() {
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-start gap-2.5">
      <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <p className="text-xs text-amber-800 leading-relaxed">
        <strong>Medical Notice:</strong> Always consult your doctor or pharmacist before switching medicines,
        especially modified-release (SR/ER/CR) formulations or critical therapeutic drugs.
      </p>
    </div>
  )
}