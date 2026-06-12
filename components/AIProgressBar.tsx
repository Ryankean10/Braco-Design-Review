'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

interface Stage { pct: number; label: string; ms: number }

interface Props {
  stages: Stage[]
  note?: string
}

export default function AIProgressBar({ stages, note }: Props) {
  const [progress, setProgress] = useState(0)
  const [label, setLabel] = useState(stages[0]?.label ?? 'Working…')

  useEffect(() => {
    let i = 0
    let cancelled = false
    function tick() {
      if (cancelled || i >= stages.length) return
      const s = stages[i++]
      setProgress(s.pct)
      setLabel(s.label)
      setTimeout(tick, s.ms)
    }
    tick()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-xl border px-4 py-4 space-y-3" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
        <span className="flex items-center gap-1.5">
          <Sparkles size={12} className="animate-pulse" style={{ color: 'var(--accent)' }} />
          {label}
        </span>
        <span style={{ color: 'var(--accent)' }}>{progress}%</span>
      </div>
      <div className="w-full rounded-full h-2" style={{ background: 'var(--border)' }}>
        <div
          className="h-2 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progress}%`, background: 'linear-gradient(90deg, var(--accent), #a855f7)' }}
        />
      </div>
      {note && <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>{note}</p>}
    </div>
  )
}
