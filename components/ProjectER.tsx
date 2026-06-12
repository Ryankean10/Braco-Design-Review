'use client'

import { useState } from 'react'
import { FileText, Sparkles, X, ChevronDown, ChevronRight, AlertCircle, CheckCircle, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Document } from '@/lib/types'

interface MissingStandard {
  ref: string
  title: string
  category: string
  reason: string
}

interface Props {
  projectId: string
  erDocumentId: string | null
  erMissingStandards: MissingStandard[]
  erAnalysedAt: string | null
  documents: Document[]  // all project documents to pick from
}

export default function ProjectER({
  projectId,
  erDocumentId: initErDocId,
  erMissingStandards: initMissing,
  erAnalysedAt: initAnalysedAt,
  documents,
}: Props) {
  const [erDocumentId, setErDocumentId] = useState(initErDocId)
  const [missing, setMissing] = useState<MissingStandard[]>(initMissing ?? [])
  const [analysedAt, setAnalysedAt] = useState(initAnalysedAt)
  const [analysing, setAnalysing] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ linked: number } | null>(null)
  const [picking, setPicking] = useState(false)
  const [expandedMissing, setExpandedMissing] = useState(false)
  const [dismissedMissing, setDismissedMissing] = useState<Set<string>>(new Set())

  const supabase = createClient()

  const erDoc = documents.find(d => d.id === erDocumentId)
  const docsWithFiles = documents.filter(d => d.storage_path || d.file_name)

  async function selectDoc(docId: string) {
    await supabase.from('projects').update({ er_document_id: docId }).eq('id', projectId)
    setErDocumentId(docId)
    setPicking(false)
    setResult(null)
    setError('')
  }

  async function removeER() {
    await supabase.from('projects').update({ er_document_id: null }).eq('id', projectId)
    setErDocumentId(null)
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
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <FileText size={16} style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Employer's Requirements</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(108,114,245,0.15)', color: 'var(--accent)' }}>Master Reference</span>
        </div>
      </div>

      <div className="p-5 space-y-4" style={{ background: 'var(--bg-elevated)' }}>
        {/* No ER linked */}
        {!erDocumentId && !picking && (
          <div className="border-2 border-dashed rounded-xl p-6 text-center" style={{ borderColor: 'var(--border)' }}>
            <FileText size={24} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No ER document linked</p>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              Link the Employer's Requirements document from your project library. The AI will cross-reference it against all standards and identify what applies to this project.
            </p>
            <button
              onClick={() => setPicking(true)}
              className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium text-white"
              style={{ background: 'var(--accent)' }}
            >
              <Plus size={14} />
              Select ER from document library
            </button>
          </div>
        )}

        {/* Document picker */}
        {picking && (
          <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Select ER document</p>
              <button onClick={() => setPicking(false)} style={{ color: 'var(--text-muted)' }}><X size={13} /></button>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {docsWithFiles.length === 0 ? (
                <p className="text-xs p-4 text-center" style={{ color: 'var(--text-muted)' }}>No documents with files attached in the project library</p>
              ) : docsWithFiles.map(doc => (
                <button
                  key={doc.id}
                  onClick={() => selectDoc(doc.id)}
                  className="w-full flex items-start gap-3 px-4 py-2.5 border-b text-left hover:opacity-80 transition-opacity"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}
                >
                  <FileText size={13} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{doc.title}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{doc.doc_no} Rev {doc.rev}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ER linked */}
        {erDocumentId && erDoc && (
          <div className="rounded-xl border px-4 py-3 flex items-start gap-3" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <FileText size={16} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{erDoc.title}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{erDoc.doc_no} Rev {erDoc.rev}</p>
              {analysedAt && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Last analysed: {new Date(analysedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPicking(true)}
                className="text-xs px-2.5 py-1 rounded-lg border"
                style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
              >
                Change
              </button>
              <button onClick={removeER} style={{ color: 'var(--text-muted)' }}><X size={13} /></button>
            </div>
          </div>
        )}

        {/* Analyse button */}
        {erDocumentId && erDoc && (
          <button
            onClick={analyse}
            disabled={analysing}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-60"
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

        {/* Success result */}
        {result && (
          <div className="flex items-start gap-2 rounded-lg px-3 py-2.5" style={{ background: '#052e16', border: '1px solid #166534' }}>
            <CheckCircle size={13} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--success)' }} />
            <p className="text-xs" style={{ color: '#86efac' }}>
              {result.linked > 0
                ? `${result.linked} standard${result.linked !== 1 ? 's' : ''} automatically linked to this project from the library.`
                : 'Analysis complete — standards reviewed.'
              }
              {visibleMissing.length > 0 && ` ${visibleMissing.length} additional standard${visibleMissing.length !== 1 ? 's' : ''} identified as gaps (see below).`}
            </p>
          </div>
        )}

        {/* Missing standards (gaps) */}
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
                  {visibleMissing.length} standard{visibleMissing.length !== 1 ? 's' : ''} referenced in ER not yet in library
                </span>
              </div>
              {expandedMissing ? <ChevronDown size={13} style={{ color: '#fb923c' }} /> : <ChevronRight size={13} style={{ color: '#fb923c' }} />}
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
                      <p className="text-[10px]" style={{ color: '#fdba74', lineHeight: 1.5 }}>{m.reason}</p>
                    </div>
                    <button
                      onClick={() => setDismissedMissing(prev => new Set([...prev, m.ref]))}
                      className="flex-shrink-0"
                      style={{ color: '#fb923c' }}
                      title="Dismiss"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <div className="px-4 py-2.5" style={{ background: '#1c0a00' }}>
                  <p className="text-[10px]" style={{ color: '#fb923c' }}>
                    Add these to the Reference Library so future projects and AI reviews can use them.
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
