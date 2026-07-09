'use client'

import { useState } from 'react'
import { Zap, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'

interface Props {
  projectId: string
  onComplete?: () => void
}

export default function GenerateQcsButton({ projectId, onComplete }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null)
  const [errMsg, setErrMsg] = useState('')

  async function handleGenerate() {
    if (status === 'loading') return
    setStatus('loading')
    setResult(null)
    setErrMsg('')

    try {
      const res = await fetch(`/api/projects/${projectId}/qcs/generate`, { method: 'POST' })
      const json = await res.json()

      if (!res.ok) {
        setStatus('error')
        setErrMsg(json.error ?? 'Generation failed')
        return
      }

      setResult(json)
      setStatus('done')
      onComplete?.()

      // Reload page after 2s to show new QCS docs
      setTimeout(() => window.location.reload(), 2000)
    } catch (e: any) {
      setStatus('error')
      setErrMsg(e.message)
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={handleGenerate}
        disabled={status === 'loading'}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-opacity"
        style={{
          background: status === 'done' ? '#22c55e' : '#6366f1',
          color: '#fff',
          opacity: status === 'loading' ? 0.7 : 1,
          cursor: status === 'loading' ? 'not-allowed' : 'pointer',
        }}>
        {status === 'loading' ? (
          <><Loader2 size={14} className="animate-spin" /> Generating QCS pack…</>
        ) : status === 'done' ? (
          <><CheckCircle2 size={14} /> Generated</>
        ) : (
          <><Zap size={14} /> Generate QCS Pack</>
        )}
      </button>

      {status === 'done' && result && (
        <p className="text-xs" style={{ color: '#22c55e' }}>
          {result.created} QCS document{result.created !== 1 ? 's' : ''} created
          {result.skipped > 0 ? `, ${result.skipped} skipped` : ''}
          {result.errors.length > 0 ? `, ${result.errors.length} errors` : ''}
        </p>
      )}

      {status === 'error' && (
        <div className="flex items-start gap-1.5">
          <AlertTriangle size={12} style={{ color: '#ef4444', marginTop: 2, flexShrink: 0 }} />
          <p className="text-xs" style={{ color: '#ef4444' }}>{errMsg}</p>
        </div>
      )}

      {status === 'done' && result && result.errors.length > 0 && (
        <details className="text-xs" style={{ color: 'var(--text-muted)' }}>
          <summary className="cursor-pointer">Show errors</summary>
          <ul className="mt-1 space-y-0.5 pl-2">
            {result.errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </details>
      )}
    </div>
  )
}
