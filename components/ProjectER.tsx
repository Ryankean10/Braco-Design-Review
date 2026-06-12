'use client'

import { useState, useRef } from 'react'
import { FileText, Sparkles, X, Upload, ChevronDown, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface MissingStandard {
  ref: string
  title: string
  category: string
  reason: string
}

interface Props {
  projectId: string
  erStoragePath: string | null
  erFileName: string | null
  erMissingStandards: MissingStandard[]
  erAnalysedAt: string | null
}

export default function ProjectER({
  projectId,
  erStoragePath: initStoragePath,
  erFileName: initFileName,
  erMissingStandards: initMissing,
  erAnalysedAt: initAnalysedAt,
}: Props) {
  const [storagePath, setStoragePath] = useState(initStoragePath)
  const [fileName, setFileName] = useState(initFileName)
  const [missing, setMissing] = useState<MissingStandard[]>(initMissing ?? [])
  const [analysedAt, setAnalysedAt] = useState(initAnalysedAt)
  const [uploading, setUploading] = useState(false)
  const [analysing, setAnalysing] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ linked: number } | null>(null)
  const [expandedMissing, setExpandedMissing] = useState(true)
  const [dismissedMissing, setDismissedMissing] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  async function handleUpload(file: File) {
    if (!file || file.type !== 'application/pdf') {
      setError('Please upload a PDF file')
      return
    }
    setUploading(true)
    setError('')

    const path = `${projectId}/er/${Date.now()}-${file.name.replace(/\s+/g, '_')}`

    // Remove old file if exists
    if (storagePath) {
      await supabase.storage.from('documents').remove([storagePath])
    }

    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(path, file, { upsert: false })

    if (uploadErr) {
      setError(`Upload failed: ${uploadErr.message}`)
      setUploading(false)
      return
    }

    const { error: dbErr } = await supabase.from('projects')
      .update({ er_storage_path: path, er_file_name: file.name })
      .eq('id', projectId)

    if (dbErr) {
      setError(`Failed to save: ${dbErr.message}`)
      setUploading(false)
      return
    }

    setStoragePath(path)
    setFileName(file.name)
    setResult(null)
    setUploading(false)
  }

  async function removeER() {
    if (storagePath) {
      await supabase.storage.from('documents').remove([storagePath])
    }
    await supabase.from('projects').update({
      er_storage_path: null,
      er_file_name: null,
      er_missing_standards: [],
      er_analysed_at: null,
    }).eq('id', projectId)
    setStoragePath(null)
    setFileName(null)
    setMissing([])
    setAnalysedAt(null)
    setResult(null)
    setError('')
  }

  async function analyse() {
    setAnalysing(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/analyse-er`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed')
      setResult({ linked: data.linked })
      setMissing(data.missing ?? [])
      setAnalysedAt(new Date().toISOString())
      setExpandedMissing(true)
      setDismissedMissing(new Set())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setAnalysing(false)
    }
  }

  const visibleMissing = missing.filter(m => !dismissedMissing.has(m.ref))

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <FileText size={16} style={{ color: 'var(--accent)' }} />
        <div className="flex-1">
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Employer's Requirements</span>
          <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(108,114,245,0.15)', color: 'var(--accent)' }}>Master Reference</span>
        </div>
        {storagePath && (
          <button onClick={removeER} className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            <X size={12} /> Remove
          </button>
        )}
      </div>

      <div className="p-5 space-y-4" style={{ background: 'var(--bg-elevated)' }}>

        {/* Upload zone — shown when no ER or to replace */}
        {!storagePath && (
          <div
            className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:opacity-80 transition-opacity"
            style={{ borderColor: 'var(--border)' }}
            onClick={() => inputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleUpload(f) }}
          >
            <Upload size={24} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
              {uploading ? 'Uploading…' : 'Upload Employer\'s Requirements'}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Drop the ER PDF here or click to browse. The AI will cross-reference it against the standards library and identify what applies to this project.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }}
            />
          </div>
        )}

        {/* Attached ER */}
        {storagePath && fileName && (
          <div className="flex items-center gap-3 rounded-xl border px-4 py-3" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <FileText size={20} style={{ color: 'var(--accent)' }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{fileName}</p>
              {analysedAt && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Last analysed {new Date(analysedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
            <button
              onClick={() => inputRef.current?.click()}
              className="text-xs px-2.5 py-1 rounded-lg border flex-shrink-0"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
            >
              Replace
            </button>
            <input ref={inputRef} type="file" accept=".pdf" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
          </div>
        )}

        {/* Analyse button */}
        {storagePath && (
          <button
            onClick={analyse}
            disabled={analysing || uploading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-white disabled:opacity-60 transition-opacity"
            style={{ background: 'linear-gradient(135deg, var(--accent), #a855f7)' }}
          >
            <Sparkles size={15} className={analysing ? 'animate-pulse' : ''} />
            {analysing
              ? 'Analysing ER against standards library…'
              : analysedAt ? 'Re-analyse ER' : 'Analyse ER with AI'
            }
          </button>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg px-3 py-2.5" style={{ background: '#3f1212', border: '1px solid #7f1d1d' }}>
            <AlertCircle size={13} className="mt-0.5 flex-shrink-0" style={{ color: '#f87171' }} />
            <p className="text-xs" style={{ color: '#fca5a5' }}>{error}</p>
          </div>
        )}

        {/* Success */}
        {result && (
          <div className="flex items-start gap-2 rounded-lg px-3 py-2.5" style={{ background: '#052e16', border: '1px solid #166534' }}>
            <CheckCircle size={13} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--success)' }} />
            <p className="text-xs" style={{ color: '#86efac' }}>
              {result.linked > 0
                ? `${result.linked} standard${result.linked !== 1 ? 's' : ''} automatically linked to this project.`
                : 'Analysis complete — all applicable standards reviewed.'
              }
              {visibleMissing.length > 0 && ` ${visibleMissing.length} gap${visibleMissing.length !== 1 ? 's' : ''} identified below.`}
            </p>
          </div>
        )}

        {/* Gap list */}
        {visibleMissing.length > 0 && (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#854d0e' }}>
            <button
              onClick={() => setExpandedMissing(e => !e)}
              className="w-full flex items-center justify-between px-4 py-3"
              style={{ background: '#431407' }}
            >
              <div className="flex items-center gap-2">
                <AlertCircle size={13} style={{ color: '#fb923c' }} />
                <span className="text-xs font-semibold" style={{ color: '#fed7aa' }}>
                  {visibleMissing.length} standard{visibleMissing.length !== 1 ? 's' : ''} referenced in ER — not yet in library
                </span>
              </div>
              {expandedMissing
                ? <ChevronDown size={13} style={{ color: '#fb923c' }} />
                : <ChevronRight size={13} style={{ color: '#fb923c' }} />
              }
            </button>
            {expandedMissing && (
              <div className="divide-y" style={{ borderColor: '#7c2d12' }}>
                {visibleMissing.map(m => (
                  <div key={m.ref} className="px-4 py-3 flex items-start gap-3" style={{ background: '#1c0a00' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-semibold" style={{ color: '#fb923c' }}>{m.ref}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#431407', color: '#fed7aa' }}>{m.category}</span>
                      </div>
                      <p className="text-xs font-medium mb-0.5" style={{ color: '#fed7aa' }}>{m.title}</p>
                      <p className="text-[10px] leading-relaxed" style={{ color: '#fdba74' }}>{m.reason}</p>
                    </div>
                    <button
                      onClick={() => setDismissedMissing(prev => new Set([...prev, m.ref]))}
                      title="Dismiss"
                      style={{ color: '#fb923c' }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <div className="px-4 py-2.5" style={{ background: '#1c0a00' }}>
                  <p className="text-[10px]" style={{ color: '#fb923c' }}>
                    Add these to the Reference Library so they are available for AI reviews on this and future projects.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
