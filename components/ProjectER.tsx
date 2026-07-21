'use client'

import { useState, useRef } from 'react'
import { FileText, Sparkles, X, Upload, ChevronDown, ChevronRight, AlertCircle, CheckCircle, MessageSquare, Scale, Send, Quote } from 'lucide-react'
import AIProgressBar from '@/components/AIProgressBar'
import { createClient } from '@/lib/supabase/client'

type InterrogatePosition = 'NOT_REQUIRED' | 'REQUIRED' | 'AMBIGUOUS' | 'NOT_COVERED' | 'PARTIALLY_REQUIRED'

interface InterrogateClause {
  ref: string
  text: string
  significance: string
}

interface InterrogateResult {
  position: InterrogatePosition
  position_label: string
  summary: string
  clauses: InterrogateClause[]
  argument: string
  suggested_response: string
}

const POSITION_STYLES: Record<InterrogatePosition, { bg: string; border: string; text: string; label: string }> = {
  NOT_REQUIRED:       { bg: '#052e16', border: '#166534', text: '#86efac', label: '✓ Not Required' },
  NOT_COVERED:        { bg: '#0c1a3a', border: '#1e3a8a', text: '#93c5fd', label: '◈ Not Covered in ER' },
  AMBIGUOUS:          { bg: '#2d1b00', border: '#854d0e', text: '#fcd34d', label: '⚠ Ambiguous' },
  PARTIALLY_REQUIRED: { bg: '#2d1b00', border: '#92400e', text: '#fdba74', label: '◑ Partially Required' },
  REQUIRED:           { bg: '#3f1212', border: '#7f1d1d', text: '#fca5a5', label: '✗ Required by ER' },
}

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

  // Interrogator state
  const [question, setQuestion] = useState('')
  const [interrogating, setInterrogating] = useState(false)
  const [interrogateResult, setInterrogateResult] = useState<InterrogateResult | null>(null)
  const [interrogateError, setInterrogateError] = useState('')
  const [askedQuestion, setAskedQuestion] = useState('')

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
      const text = await res.text()
      let data: any
      try { data = JSON.parse(text) } catch { throw new Error(text.slice(0, 300) || 'Server error — possible timeout') }
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

  async function interrogate() {
    if (!question.trim()) return
    setInterrogating(true)
    setInterrogateError('')
    setInterrogateResult(null)
    setAskedQuestion(question)
    try {
      const res = await fetch(`/api/projects/${projectId}/er-interrogate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Interrogation failed')
      setInterrogateResult(data.result)
    } catch (e: any) {
      setInterrogateError(e.message)
    } finally {
      setInterrogating(false)
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

        {/* Analyse button / progress bar */}
        {storagePath && !analysing && (
          <button
            onClick={analyse}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-white disabled:opacity-60 transition-opacity"
            style={{ background: 'linear-gradient(135deg, var(--accent), #a855f7)' }}
          >
            <Sparkles size={15} />
            {analysedAt ? 'Re-analyse ER' : 'Analyse ER with AI'}
          </button>
        )}

        {analysing && (
          <AIProgressBar
            stages={[
              { pct: 8,  label: 'Downloading ER from storage…',          ms: 800  },
              { pct: 20, label: 'Extracting text from PDF…',             ms: 1200 },
              { pct: 35, label: 'Loading standards library…',            ms: 600  },
              { pct: 50, label: 'Sending to AI for analysis…',           ms: 1000 },
              { pct: 65, label: "Reading Employer's Requirements…",       ms: 8000 },
              { pct: 78, label: 'Cross-referencing standards…',          ms: 8000 },
              { pct: 90, label: 'Identifying gaps…',                     ms: 5000 },
            ]}
            note="This takes 30–60 seconds — AI is reading the full ER document"
          />
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
        {/* ER Commercial Interrogator — only when ER is uploaded */}
        {storagePath && (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            {/* Section header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <Scale size={13} style={{ color: '#a78bfa' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Commercial Interrogator</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full ml-1" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>AI · Commercial Bias</span>
            </div>

            <div className="p-4 space-y-3" style={{ background: 'var(--bg-elevated)' }}>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Ask a question about the ER. The AI will search the document and respond with a commercial bias — looking for arguments that the requirement is not in scope, advisory only, or a potential variation.
              </p>

              {/* Question input */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <MessageSquare size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !interrogating) interrogate() }}
                    placeholder="e.g. Is cable containment in troughs required by the ER?"
                    className="w-full rounded-lg border pl-8 pr-3 py-2.5 text-sm"
                    style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                    disabled={interrogating}
                  />
                </div>
                <button
                  onClick={interrogate}
                  disabled={interrogating || !question.trim()}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 shrink-0"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
                >
                  <Send size={11} />
                  {interrogating ? 'Searching…' : 'Search ER'}
                </button>
              </div>

              {/* Loading */}
              {interrogating && (
                <AIProgressBar
                  stages={[
                    { pct: 10, label: 'Downloading ER from storage…',    ms: 800  },
                    { pct: 25, label: 'Extracting text from PDF…',       ms: 1000 },
                    { pct: 45, label: 'Searching for relevant clauses…', ms: 5000 },
                    { pct: 70, label: 'Building commercial argument…',   ms: 8000 },
                    { pct: 90, label: 'Drafting suggested response…',    ms: 5000 },
                  ]}
                  note="Searching full ER document — typically 20–45 seconds"
                />
              )}

              {/* Error */}
              {interrogateError && (
                <div className="flex items-start gap-2 rounded-lg px-3 py-2.5" style={{ background: '#3f1212', border: '1px solid #7f1d1d' }}>
                  <AlertCircle size={13} className="mt-0.5 shrink-0" style={{ color: '#f87171' }} />
                  <p className="text-xs" style={{ color: '#fca5a5' }}>{interrogateError}</p>
                </div>
              )}

              {/* Result */}
              {interrogateResult && (() => {
                const pos = interrogateResult.position in POSITION_STYLES ? interrogateResult.position : 'AMBIGUOUS'
                const style = POSITION_STYLES[pos]
                return (
                  <div className="space-y-3">
                    {/* Question echo + position badge */}
                    <div className="rounded-lg px-3 py-2.5 border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                      <p className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Question asked:</p>
                      <p className="text-xs italic" style={{ color: 'var(--text-primary)' }}>"{askedQuestion}"</p>
                    </div>

                    {/* Position badge */}
                    <div className="rounded-lg px-4 py-3 border" style={{ background: style.bg, borderColor: style.border }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold" style={{ color: style.text }}>{style.label}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full border" style={{ background: style.bg, borderColor: style.border, color: style.text }}>
                          {interrogateResult.position_label}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: style.text }}>{interrogateResult.summary}</p>
                    </div>

                    {/* Relevant clauses */}
                    {interrogateResult.clauses.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Relevant clauses found</p>
                        {interrogateResult.clauses.map((clause, i) => (
                          <div key={i} className="rounded-lg border p-3" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Quote size={10} style={{ color: '#a78bfa' }} />
                              <span className="text-[10px] font-mono font-semibold" style={{ color: '#a78bfa' }}>{clause.ref}</span>
                            </div>
                            <p className="text-xs italic mb-1.5 leading-relaxed" style={{ color: 'var(--text-primary)' }}>"{clause.text}"</p>
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{clause.significance}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {interrogateResult.clauses.length === 0 && (
                      <div className="rounded-lg border px-3 py-2.5 text-xs" style={{ background: '#0c1a3a', borderColor: '#1e3a8a', color: '#93c5fd' }}>
                        No specific clauses found in the ER for this matter — supports a "not in scope" position.
                      </div>
                    )}

                    {/* Commercial argument */}
                    <div className="rounded-lg border p-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Commercial Argument</p>
                      <div className="text-xs leading-relaxed space-y-2" style={{ color: 'var(--text-primary)' }}>
                        {interrogateResult.argument.split('\n').filter(Boolean).map((para, i) => (
                          <p key={i}>{para}</p>
                        ))}
                      </div>
                    </div>

                    {/* Suggested response */}
                    <div className="rounded-lg border p-4" style={{ background: 'rgba(167,139,250,0.06)', borderColor: '#7c3aed44' }}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#a78bfa' }}>Suggested Response</p>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>{interrogateResult.suggested_response}</p>
                      <button
                        onClick={() => navigator.clipboard.writeText(interrogateResult.suggested_response)}
                        className="mt-2 text-[10px] px-2 py-1 rounded border hover:opacity-70"
                        style={{ borderColor: '#7c3aed44', color: '#a78bfa' }}
                      >
                        Copy to clipboard
                      </button>
                    </div>

                    {/* Ask another */}
                    <button
                      onClick={() => { setInterrogateResult(null); setQuestion(''); setAskedQuestion('') }}
                      className="text-xs" style={{ color: 'var(--text-muted)' }}
                    >
                      ← Ask another question
                    </button>
                  </div>
                )
              })()}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
