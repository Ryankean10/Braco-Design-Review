'use client'

import { useState } from 'react'
import { FileText, Sparkles, Download, CheckCircle2, XCircle, Clock, MessageSquare, ChevronDown, ChevronRight } from 'lucide-react'

interface FindingMarkup {
  id: string
  run_id: string
  lens: string
  severity: string
  title: string
  description: string
  clause_ref: string | null
  status: 'Pending' | 'Approved' | 'Rejected'
  quote: string | null
  designer_response: string | null
  designer_responded_at: string | null
}

interface Run {
  id: string
  run_at: string
  markup_html: string | null
}

interface Props {
  projectId: string
  run: Run | null
  findings: FindingMarkup[]
  canEdit: boolean
}

const SEVERITY_CFG: Record<string, { color: string; bg: string }> = {
  Critical:    { color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  Major:       { color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  Minor:       { color: '#facc15', bg: 'rgba(250,204,21,0.12)' },
  Observation: { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
}

const APPROVE_DECISIONS = ['Design Change Required', 'Accepted as Risk', 'Deferred to Later Stage', 'Further Investigation Required']
const REJECT_DECISIONS  = ['Not Applicable', 'AI Interpretation Error', 'Duplicate Finding', 'Out of Scope']

export default function MarkupBox({ projectId, run, findings, canEdit }: Props) {
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [markupHtml, setMarkupHtml] = useState<string | null>(run?.markup_html ?? null)
  const [localFindings, setLocalFindings] = useState<FindingMarkup[]>(findings)
  const [responseText, setResponseText] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set())
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewAction, setReviewAction] = useState<'Approved' | 'Rejected' | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [reviewDecision, setReviewDecision] = useState('')
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [submittingReview, setSubmittingReview] = useState(false)

  async function generateMarkup() {
    if (!run) return
    setGenerating(true)
    setGenError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/generate-markup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: run.id }),
      })
      let data: any
      try {
        data = await res.json()
      } catch {
        setGenError(`Server error (${res.status}) — check that PDFs are readable and try again`)
        return
      }
      if (!res.ok) { setGenError(data.error ?? 'Generation failed'); return }
      setMarkupHtml(data.markup_html)
      // Update local findings with quotes from response
      if (data.quotes) {
        setLocalFindings(prev => prev.map(f =>
          data.quotes[f.id] ? { ...f, quote: data.quotes[f.id] } : f
        ))
      }
    } catch (e: any) {
      setGenError(e.message ?? 'Network error')
    } finally {
      setGenerating(false)
    }
  }

  function exportMarkup() {
    if (!markupHtml) return
    const blob = new Blob([markupHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `design-review-markup.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function saveResponse(findingId: string) {
    const text = (responseText[findingId] ?? '').trim()
    if (!text) return
    setSavingId(findingId)
    try {
      const res = await fetch(`/api/projects/${projectId}/findings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: findingId, designer_response: text }),
      })
      if (res.ok) {
        setLocalFindings(prev => prev.map(f =>
          f.id === findingId
            ? { ...f, designer_response: text, designer_responded_at: new Date().toISOString() }
            : f
        ))
      }
    } finally {
      setSavingId(null)
    }
  }

  async function submitReview(findingId: string, status: 'Approved' | 'Rejected') {
    if (!reviewDecision) { setReviewError('Please select a decision type.'); return }
    if (!reviewNote.trim()) { setReviewError('A comment is required.'); return }
    setSubmittingReview(true)
    setReviewError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/findings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: findingId, status, decision_type: reviewDecision, comment: reviewNote.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setReviewError(data.error ?? 'Failed'); return }
      setLocalFindings(prev => prev.map(f => f.id === findingId ? { ...f, status } : f))
      setReviewingId(null)
      setReviewAction(null)
      setReviewNote('')
      setReviewDecision('')
    } finally {
      setSubmittingReview(false)
    }
  }

  function toggleFinding(id: string) {
    setExpandedFindings(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const pendingFindings = localFindings.filter(f => f.status === 'Pending')
  const hasMarkup = !!markupHtml

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
      {/* Header */}
      <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <button onClick={() => setExpanded(e => !e)} className="hover:opacity-70">
            {expanded ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
          </button>
          <FileText size={15} style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Markup</span>
          {pendingFindings.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(148,163,184,0.15)', color: '#94a3b8' }}>
              {pendingFindings.length} pending
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasMarkup && (
            <button onClick={exportMarkup}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              <Download size={11} /> Export
            </button>
          )}
          {canEdit && run && (
            <button onClick={generateMarkup} disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, var(--accent), #7c3aed)' }}>
              <Sparkles size={11} className={generating ? 'animate-spin' : ''} />
              {generating ? 'Generating…' : hasMarkup ? 'Regenerate' : 'Generate Markup'}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>

          {/* Error */}
          {genError && (
            <div className="px-5 py-3 text-xs" style={{ background: 'rgba(248,113,113,0.08)', color: '#f87171' }}>
              {genError}
            </div>
          )}

          {/* Markup preview */}
          <div className="px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
              Review Document Preview
            </p>
            {hasMarkup ? (
              <div className="rounded-lg border overflow-auto max-h-80 text-xs bg-white"
                style={{ borderColor: 'var(--border)' }}
                dangerouslySetInnerHTML={{ __html: markupHtml! }}
              />
            ) : (
              <div className="rounded-lg border flex flex-col items-center justify-center py-10 text-center"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
                <FileText size={24} className="mb-2" style={{ color: 'var(--text-muted)' }} />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {run ? 'Click "Generate Markup" to create the formal review letter' : 'No review run selected'}
                </p>
              </div>
            )}
          </div>

          {/* Per-finding designer responses */}
          {localFindings.length > 0 && (
            <div className="px-5 py-4 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                Designer Responses · {localFindings.filter(f => f.designer_response).length}/{localFindings.length} recorded
              </p>
              {localFindings.map(f => {
                const sev = SEVERITY_CFG[f.severity] ?? SEVERITY_CFG.Observation
                const isOpen = expandedFindings.has(f.id)
                const hasResponse = !!f.designer_response
                const isReviewing = reviewingId === f.id

                return (
                  <div key={f.id} className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                    {/* Finding header row */}
                    <button
                      onClick={() => toggleFinding(f.id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:opacity-80"
                      style={{ background: 'var(--bg-elevated)' }}>
                      {isOpen ? <ChevronDown size={11} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={11} style={{ color: 'var(--text-muted)' }} />}
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0"
                        style={{ background: sev.bg, color: sev.color }}>
                        {f.severity}
                      </span>
                      <span className="flex-1 text-xs truncate" style={{ color: 'var(--text-primary)' }}>{f.title}</span>
                      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{
                          color: f.status === 'Approved' ? '#4ade80' : f.status === 'Rejected' ? '#f87171' : '#94a3b8',
                          background: f.status === 'Approved' ? 'rgba(74,222,128,0.15)' : f.status === 'Rejected' ? 'rgba(248,113,113,0.15)' : 'rgba(148,163,184,0.15)',
                        }}>
                        {f.status === 'Approved' ? <CheckCircle2 size={9} /> : f.status === 'Rejected' ? <XCircle size={9} /> : <Clock size={9} />}
                        {' '}{f.status}
                      </span>
                      {hasResponse && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>
                          <MessageSquare size={8} className="inline mr-0.5" />Response
                        </span>
                      )}
                    </button>

                    {/* Expanded detail */}
                    {isOpen && (
                      <div className="px-4 py-3 space-y-3 border-t" style={{ borderColor: 'var(--border)' }}>
                        {/* Quote blockquote */}
                        {f.quote && (
                          <blockquote className="border-l-2 pl-3 py-0.5 text-xs italic"
                            style={{ borderColor: sev.color, color: 'var(--text-secondary)' }}>
                            "{f.quote}"
                          </blockquote>
                        )}

                        {/* Designer response section */}
                        {f.designer_response ? (
                          <div className="rounded-lg px-3 py-2.5 space-y-1"
                            style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.25)' }}>
                            <p className="text-[10px] font-semibold" style={{ color: '#60a5fa' }}>Designer's Response</p>
                            <p className="text-xs" style={{ color: 'var(--text-primary)' }}>{f.designer_response}</p>
                            {f.designer_responded_at && (
                              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                {new Date(f.designer_responded_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </p>
                            )}
                          </div>
                        ) : canEdit ? (
                          <div className="space-y-2">
                            <label className="block text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                              RECORD DESIGNER'S RESPONSE
                            </label>
                            <textarea
                              value={responseText[f.id] ?? ''}
                              onChange={e => setResponseText(prev => ({ ...prev, [f.id]: e.target.value }))}
                              placeholder="Paste or type the designer's response to this finding…"
                              rows={3}
                              className="w-full rounded-lg px-3 py-2 text-xs resize-none"
                              style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                            />
                            <button
                              onClick={() => saveResponse(f.id)}
                              disabled={savingId === f.id || !(responseText[f.id] ?? '').trim()}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-40 hover:opacity-80"
                              style={{ background: 'var(--accent)' }}>
                              {savingId === f.id ? 'Saving…' : 'Save Response'}
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No designer response recorded yet.</p>
                        )}

                        {/* Approve / Reject after response received */}
                        {canEdit && f.designer_response && f.status === 'Pending' && !isReviewing && (
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => { setReviewingId(f.id); setReviewAction('Approved'); setReviewNote(''); setReviewDecision(''); setReviewError(null) }}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80"
                              style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
                              <CheckCircle2 size={10} /> Approve
                            </button>
                            <button
                              onClick={() => { setReviewingId(f.id); setReviewAction('Rejected'); setReviewNote(''); setReviewDecision(''); setReviewError(null) }}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80"
                              style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
                              <XCircle size={10} /> Reject
                            </button>
                          </div>
                        )}

                        {/* Inline review form */}
                        {canEdit && isReviewing && reviewAction && (
                          <div className="rounded-xl border p-3 space-y-3"
                            style={{ borderColor: reviewAction === 'Approved' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)', background: 'var(--bg-surface)' }}>
                            <p className="text-xs font-semibold"
                              style={{ color: reviewAction === 'Approved' ? '#4ade80' : '#f87171' }}>
                              {reviewAction === 'Approved' ? '✓ Record Approval' : '✕ Record Rejection'}
                            </p>
                            <select
                              value={reviewDecision}
                              onChange={e => setReviewDecision(e.target.value)}
                              className="w-full rounded-lg px-3 py-2 text-xs"
                              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: reviewDecision ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                              <option value="">Select decision type…</option>
                              {(reviewAction === 'Approved' ? APPROVE_DECISIONS : REJECT_DECISIONS).map(d => (
                                <option key={d}>{d}</option>
                              ))}
                            </select>
                            <textarea
                              value={reviewNote}
                              onChange={e => setReviewNote(e.target.value)}
                              placeholder={reviewAction === 'Approved' ? 'Action to be taken…' : 'Reason for rejection…'}
                              rows={2}
                              className="w-full rounded-lg px-3 py-2 text-xs resize-none"
                              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                            />
                            {reviewError && (
                              <p className="text-xs px-3 py-2 rounded-lg"
                                style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
                                {reviewError}
                              </p>
                            )}
                            <div className="flex gap-2">
                              <button onClick={() => submitReview(f.id, reviewAction)} disabled={submittingReview}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 hover:opacity-80"
                                style={{ background: reviewAction === 'Approved' ? '#4ade80' : '#f87171', color: '#000' }}>
                                {reviewAction === 'Approved' ? <><CheckCircle2 size={10} /> Confirm</> : <><XCircle size={10} /> Confirm</>}
                              </button>
                              <button onClick={() => { setReviewingId(null); setReviewAction(null); setReviewNote(''); setReviewDecision(''); setReviewError(null) }}
                                className="px-3 py-1.5 rounded-lg text-xs hover:opacity-80"
                                style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
