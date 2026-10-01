'use client'

import { Printer } from 'lucide-react'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity"
      style={{ background: 'var(--accent)' }}
    >
      <Printer size={14} /> Print / Save as PDF
    </button>
  )
}
