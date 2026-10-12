'use client'

import { useState } from 'react'
import { Zap, CheckCircle2, AlertTriangle } from 'lucide-react'

interface Props {
  projectId: string
}

type Status = 'idle' | 'loading' | 'done' | 'error'

export default function GenerateQcsButton({ projectId }: Props) {
  const [status, setStatus]     = useState<Status>('idle')
  const [total, setTotal]       = useState(0)
  const [current, setCurrent]   = useState(0)
  const [currentRef, setCurrentRef] = useState('')
  const [result, setResult]     = useState<{ created: number; skipped: number; errors: string[] } | null>(null)
  const [errMsg, setErrMsg]     = useState('')

  async function handleGenerate() {
    if (status === 'loading') return
    setStatus('loading')
    setResult(null)
    setErrMsg('')
    setTotal(0)
    setCurrent(0)
    setCurrentRef('')

    try {
      const res = await fetch(`/api/projects/${projectId}/qcs/generate`, { method: 'POST' })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setStatus('error')
        setErrMsg(json.error ?? 'Generation failed')
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const msg = JSON.parse(line)
            if (msg.type === 'total') {
              setTotal(msg.count)
            } else if (msg.type === 'progress') {
              setCurrent(msg.current)
              setCurrentRef(msg.ref ?? '')
            } else if (msg.type === 'done') {
              setResult({ created: msg.created, skipped: msg.skipped, errors: msg.errors })
              setStatus('done')
              setTimeout(() => window.location.reload(), 2500)
            }
          } catch {}
        }
      }
    } catch (e: any) {
      setStatus('error')
      setErrMsg(e.message)
    }
  }

  const pct = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div className="flex flex-col items-start gap-3 w-full max-w-sm">

      {/* Button */}
      <button
        onClick={handleGenerate}
        disabled={status === 'loading'}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-opacity shrink-0"
        style={{
          background: status === 'done' ? '#22c55e' : '#6366f1',
          color: '#fff',
          opacity: status === 'loading' ? 0.6 : 1,
          cursor: status === 'loading' ? 'not-allowed' : 'pointer',
        }}>
        {status === 'done' ? (
          <><CheckCircle2 size={14} /> Generated</>
        ) : (
          <><Zap size={14} /> {status === 'loading' ? 'Generating…' : 'Generate QCS Pack'}</>
        )}
      </button>

      {/* Progress bar */}
      {status === 'loading' && total > 0 && (
        <div className="w-full">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
              {current} / {total} documents
            </span>
            <span className="text-xs tabular-nums" style={{ color: '#6366f1' }}>{pct}%</span>
          </div>
          <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: 'var(--border)' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${pct}%`, background: '#6366f1' }}
            />
          </div>
          {currentRef && (
            <p className="text-[11px] mt-1.5 truncate" style={{ color: 'var(--text-muted)' }}>
              {currentRef}
            </p>
          )}
        </div>
      )}

      {/* Done summary */}
      {status === 'done' && result && (
        <div className="text-xs space-y-0.5">
          <p style={{ color: '#22c55e' }}>
            ✓ {result.created} QCS document{result.created !== 1 ? 's' : ''} created
            {result.skipped > 0 ? `, ${result.skipped} skipped` : ''}
          </p>
          {result.errors.length > 0 && (
            <details style={{ color: 'var(--text-muted)' }}>
              <summary className="cursor-pointer">{result.errors.length} error{result.errors.length !== 1 ? 's' : ''}</summary>
              <ul className="mt-1 space-y-0.5 pl-2">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="flex items-start gap-1.5">
          <AlertTriangle size={12} style={{ color: '#ef4444', marginTop: 2, flexShrink: 0 }} />
          <p className="text-xs" style={{ color: '#ef4444' }}>{errMsg}</p>
        </div>
      )}
    </div>
  )
}
