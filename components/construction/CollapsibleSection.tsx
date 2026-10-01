'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface Props {
  title: string
  badge?: string | number
  summary?: string
  defaultOpen?: boolean
  children: React.ReactNode
}

export default function CollapsibleSection({ title, badge, summary, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:opacity-80 transition-opacity text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wider shrink-0" style={{ color: 'var(--text-muted)' }}>{title}</span>
          {badge !== undefined && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
              style={{ background: 'rgba(108,114,245,0.12)', color: 'var(--accent)' }}>
              {badge}
            </span>
          )}
          {!open && summary && (
            <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{summary}</span>
          )}
        </div>
        {open
          ? <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} />
          : <ChevronRight size={15} style={{ color: 'var(--text-muted)' }} />}
      </button>

      {open && (
        <div className="border-t" style={{ borderColor: 'var(--border)' }}>
          {children}
        </div>
      )}
    </div>
  )
}
