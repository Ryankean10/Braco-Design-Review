'use client'

import { Construction } from 'lucide-react'

export default function WorkPlannerComingSoon() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
      <div className="rounded-full p-4" style={{ background: 'var(--bg-elevated)' }}>
        <Construction size={36} style={{ color: 'var(--text-muted)' }} />
      </div>
      <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        Personnel Planner
      </h1>
      <p className="text-sm text-center max-w-sm" style={{ color: 'var(--text-muted)' }}>
        This module is being configured for Boreas Power. Check back soon.
      </p>
    </div>
  )
}
