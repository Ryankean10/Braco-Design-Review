'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Sparkles, CheckCircle2, XCircle, Clock, AlertTriangle,
  ChevronDown, ChevronRight, FileText, ShoppingCart, Eye, EyeOff,
} from 'lucide-react'

const LENSES = [
  { key: 'er_compliance',    label: "ER Compliance",       color: '#60a5fa', desc: "Non-conformances with Employer's Requirements" },
  { key: 'standards',        label: 'Standards',           color: '#a78bfa', desc: 'Missing or contravened applicable standards' },
  { key: 'constructability', label: 'Constructability',    color: '#fb923c', desc: 'Build-sequence, access and rework risks' },
  { key: 'procurement',      label: 'Procurement Linkage', color: '#34d399', desc: 'Design-to-register gaps and lead-time flags' },
  { key: 'clash',            label: 'Clash Detection',     color: '#f472b6', desc: 'Physical and compliance clashes across documents' },
] as const

type LensKey = typeof LENSES[number]['key']

const SEVERITY_CFG: Record<string, { color: string; bg: string }> = {
  Critical:    { color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  Major:       { color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  Minor:       { color: '#facc15', bg: 'rgba(250,204,21,0.12)' },
  Observation: { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
}

const STATUS_CFG = {
  Pending:  { color: '#94a3b8', icon: <Clock size={11} /> },
  Approved: { color: '#4ade80', icon: <CheckCircle2 size={11} /> },
  Rejected: { color: '#f87171', icon: <XCircle size={11} /> },
}

interface Doc {
  id: string
  doc_no: string
  title: string
  rev: string
  type: string
  stage: string
}

interface Finding {
  id: string
  run_id: string
  lens: LensKey
  severity: string
  title: string
  description: string
  clause_ref: string | null
  drawing_refs: string[]
  document_refs: string[]
  procurement_item_id: string | null
  status: 'Pending' | 'Approved' | 'Rejected'
  decision_type: string | null
  reviewed_at: string | null
  review_notes: string | null
  reviewer_name: string | null
}

interface Run {
  id: string
  run_at: string
  status: string
  lenses: string[]
  document_ids: string[]
  runner_name: string | null
  error: string | null
}

interface Props {
  projectId: string
  projectName: string
  hasER: boolean
  canEdit: boolean
  documents: Doc[]
  initialRuns: Run[]
  initialFindings: Finding[]
}

export default function ReviewsPanel({
  projectId, projectName, hasER, canEdit,
  documents, initialRuns, initialFindings,
}: Props) {
  const [selectedDocs, setSelectedDocs] = useState<string[]>([])
  const [selectedLenses, setSelectedLenses] = useState<LensKey[]>(['er_compliance', 'standards', 'constructability', 'procurement', 'clash'])
  const [runs, setRuns] = useState<Run[]>(initialRuns)
  const [findings, setFindings] = useState<Finding[]>(initialFindings)
  const [isRunning, setIsRunning] = useState(false)
  const [runProgress, setRunProgress] = useState<{ lens: string; pct: number } | null>(null)
  // Show any persistent warning from the most recent run (survives page reload)
  const latestRunWarning = initialRuns[0]?.error ?? null
  const [runError, setRunError] = useState<string | null>(latestRunWarning)
  const [expandedLenses, setExpandedLenses] = useState<Set<string>>(new Set(['er_compliance']))
  const [filterStatus, setFilterStatus] = useState<'all' | 'Pending' | 'Approved' | 'Rejected'>('all')
  const [activeRunId, setActiveRunId] = useState<string>('all')
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewingAction, setReviewingAction] = useState<'Approved' | 'Rejected' | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [reviewDecisionType, setReviewDecisionType] = useState('')
  const [reviewError, setReviewError] = useState<string | null>(null)

  function toggleDoc(id: string) {
    setSelectedDocs(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id])
  }

  function toggleLens(key: LensKey) {
    setSelectedLenses(prev => prev.includes(key) ? prev.filter(l => l !== key) : [...prev, key])
  }

  function toggleExpandedLens(key: string) {
    setExpandedLenses(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function runReview() {
    if (!selectedDocs.length || !selectedLenses.length) return
    setIsRunning(true)
    setRunError(null)
    setRunProgress({ lens: `Sending ${selectedLenses.length} lens${selectedLenses.length > 1 ? 'es' : ''} to Claude…`, pct: 10 })

    // Single API call for all selected lenses
    try {
      const progressTimer = setInterval(() => {
        setRunProgress(prev => prev && prev.pct < 85 ? { ...prev, pct: prev.pct + 5 } : prev)
      }, 8000)

      const res: Response = await fetch(`/api/projects/${projectId}/run-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lenses: selectedLenses, documentIds: selectedDocs }),
      })
      clearInterval(progressTimer)

      const data: { runId?: string; findingCount?: number; byLens?: Record<string, number>; warnings?: string[]; error?: string } = await res.json()

      if (!res.ok) {
        setRunError(data.error ?? 'Review failed')
        setIsRunning(false)
        setRunProgress(null)
        return
      }

      const findingCount = data.findingCount ?? 0
      const hasWarnings = (data.warnings?.length ?? 0) > 0

      setRunProgress({ lens: `Complete — ${findingCount} finding${findingCount !== 1 ? 's' : ''} generated`, pct: 100 })

      if (hasWarnings) {
        // Keep warning visible — don't auto-reload so user can read it
        setRunError(`Some documents could not be read: ${data.warnings!.join('; ')}. A warning finding has been added to the log. Fix the PDFs and re-run to cover those documents.`)
        setIsRunning(false)
        // Reload after a longer delay so user sees the message
        setTimeout(() => window.location.reload(), 5000)
      } else {
        setTimeout(() => window.location.reload(), 1000)
      }
    } catch (e: any) {
      setRunError(`Network error: ${e.message}`)
      setIsRunning(false)
      setRunProgress(null)
    }
  }

  async function reviewFinding(findingId: string, status: 'Approved' | 'Rejected') {
    setReviewError(null)
    if (!reviewDecisionType) { setReviewError('Please select a decision type.'); return }
    if (!reviewNote.trim()) { setReviewError('A comment is required — describe what will be done or why the finding is being rejected.'); return }

    const res: Response = await fetch(`/api/projects/${projectId}/findings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: findingId, status, decision_type: reviewDecisionType, comment: reviewNote.trim() }),
    })
    const data: { ok?: boolean; error?: string } = await res.json()
    if (!res.ok) { setReviewError(data.error ?? 'Failed to save decision'); return }

    setFindings(prev => prev.map(f =>
      f.id === findingId ? { ...f, status, review_notes: reviewNote.trim() } : f
    ))
    setReviewingId(null)
    setReviewingAction(null)
    setReviewNote('')
    setReviewDecisionType('')
    setReviewError(null)
  }

  // Filter findings to active run
  // Default: show ALL findings across all runs (Pending findings never hidden)
  // Run filter only applies when explicitly selected (not the default "all" state)
  const visibleFindings = findings
    .filter(f => activeRunId !== 'all' ? f.run_id === activeRunId : true)
    .filter(f => filterStatus === 'all' || f.status === filterStatus)

  const pendingCount = visibleFindings.filter(f => f.status === 'Pending').length
  const approvedCount = visibleFindings.filter(f => f.status === 'Approved').length
  const rejectedCount = visibleFindings.filter(f => f.status === 'Rejected').length

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center gap-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <Link href={`/projects/${projectId}`} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>AI Design Reviews</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{projectName}</p>
        </div>
        <Link href={`/projects/${projectId}/decision-log`}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg hover:opacity-80"
          style={{ background: 'var(--bg-elevated)', color: 'var(--accent)', border: '1px solid var(--border)' }}>
          <Eye size={12} /> Decision Log
        </Link>
      </div>

      <div className="p-6 max-w-7xl mx-auto grid grid-cols-[340px_1fr] gap-6 items-start">

        {/* ── Left panel: run controls ─────────────────────────────────────── */}
        <div className="space-y-4 sticky top-6">

          {/* ER warning */}
          {!hasER && (
            <div className="rounded-xl border px-4 py-3 text-xs" style={{ borderColor: 'rgba(251,146,60,0.4)', background: 'rgba(251,146,60,0.08)', color: '#fb923c' }}>
              <AlertTriangle size={12} className="inline mr-1" />
              No ER uploaded — ER Compliance and Procurement lenses will flag this.
            </div>
          )}

          {/* Document selector */}
          <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Select Documents</p>
              <button onClick={() => setSelectedDocs(selectedDocs.length === documents.length ? [] : documents.map(d => d.id))}
                className="text-[10px]" style={{ color: 'var(--accent)' }}>
                {selectedDocs.length === documents.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            {documents.length === 0 ? (
              <p className="px-4 py-6 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                No documents uploaded yet.{' '}
                <Link href={`/projects/${projectId}/documents`} style={{ color: 'var(--accent)' }}>Upload documents</Link>
              </p>
            ) : (
              <div className="max-h-52 overflow-y-auto divide-y" style={{ borderColor: 'var(--border)' }}>
                {documents.map(doc => (
                  <label key={doc.id} className="flex items-start gap-3 px-4 py-2.5 cursor-pointer hover:opacity-80">
                    <input type="checkbox" checked={selectedDocs.includes(doc.id)} onChange={() => toggleDoc(doc.id)}
                      className="mt-0.5 flex-shrink-0" style={{ accentColor: 'var(--accent)' }} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        <span className="font-mono text-[10px] mr-1" style={{ color: 'var(--text-muted)' }}>{doc.doc_no}</span>
                        {doc.title}
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Rev {doc.rev} · {doc.type} · {doc.stage}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Lens selector */}
          <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Review Lenses</p>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {LENSES.map(lens => (
                <label key={lens.key} className="flex items-start gap-3 px-4 py-2.5 cursor-pointer hover:opacity-80">
                  <input type="checkbox" checked={selectedLenses.includes(lens.key)} onChange={() => toggleLens(lens.key)}
                    className="mt-0.5 flex-shrink-0" style={{ accentColor: lens.color }} />
                  <div>
                    <p className="text-xs font-medium" style={{ color: lens.color }}>{lens.label}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{lens.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Run button */}
          {canEdit && (
            <button
              onClick={runReview}
              disabled={isRunning || !selectedDocs.length || !selectedLenses.length}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, var(--accent), #7c3aed)' }}>
              <Sparkles size={15} className={isRunning ? 'animate-spin' : ''} />
              {isRunning ? 'Running AI Review…' : 'Run AI Review'}
            </button>
          )}

          {/* Progress */}
          {isRunning && runProgress && (
            <div className="rounded-xl border px-4 py-3 space-y-2" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-1.5">
                  <Sparkles size={11} className="animate-pulse" style={{ color: 'var(--accent)' }} />
                  {runProgress.lens}
                </span>
                <span style={{ color: 'var(--accent)' }}>{runProgress.pct}%</span>
              </div>
              <div className="w-full rounded-full h-1.5" style={{ background: 'var(--border)' }}>
                <div className="h-1.5 rounded-full transition-all duration-700"
                  style={{ width: `${runProgress.pct}%`, background: 'linear-gradient(90deg, var(--accent), #a855f7)' }} />
              </div>
              <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
                All {selectedLenses.length} lens{selectedLenses.length > 1 ? 'es' : ''} sent in one call — typically 60–120 s
              </p>
            </div>
          )}

          {runError && (
            <div className="rounded-xl border px-4 py-3 text-xs space-y-1.5"
              style={{
                borderColor: runError.startsWith('Some documents') || runError.startsWith('Partial') ? 'rgba(251,146,60,0.4)' : 'rgba(248,113,113,0.4)',
                background:  runError.startsWith('Some documents') || runError.startsWith('Partial') ? 'rgba(251,146,60,0.08)' : 'rgba(248,113,113,0.08)',
                color:       runError.startsWith('Some documents') || runError.startsWith('Partial') ? '#fb923c' : '#f87171',
              }}>
              <div className="flex items-start justify-between gap-2">
                <p className="flex-1">{runError}</p>
                <button onClick={() => setRunError(null)} className="flex-shrink-0 opacity-60 hover:opacity-100 text-base leading-none">×</button>
              </div>
            </div>
          )}

          {/* Past runs */}
          {runs.length > 0 && (
            <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Review History</p>
              </div>
              <div className="divide-y max-h-52 overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
                {/* All runs option */}
                <button onClick={() => setActiveRunId('all')}
                  className="w-full text-left px-4 py-2.5 hover:opacity-80"
                  style={{ background: activeRunId === 'all' ? 'rgba(108,114,245,0.1)' : 'transparent' }}>
                  <p className="text-xs font-medium" style={{ color: activeRunId === 'all' ? 'var(--accent)' : 'var(--text-primary)' }}>
                    All runs (combined)
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {findings.length} finding{findings.length !== 1 ? 's' : ''} · {findings.filter(f => f.status === 'Pending').length} pending sign-off
                  </p>
                </button>
                {runs.map(run => (
                  <button key={run.id} onClick={() => setActiveRunId(run.id)}
                    className="w-full text-left px-4 py-2.5 hover:opacity-80"
                    style={{ background: activeRunId === run.id ? 'rgba(108,114,245,0.1)' : 'transparent' }}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium" style={{ color: activeRunId === run.id ? 'var(--accent)' : 'var(--text-primary)' }}>
                        {new Date(run.run_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {' '}
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {new Date(run.run_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{
                          color: run.status === 'complete' ? '#4ade80'
                               : run.status === 'ai_complete' ? '#60a5fa'
                               : run.status === 'failed' ? '#f87171' : '#94a3b8',
                          background: run.status === 'complete' ? 'rgba(74,222,128,0.15)'
                               : run.status === 'ai_complete' ? 'rgba(96,165,250,0.15)'
                               : run.status === 'failed' ? 'rgba(248,113,113,0.15)' : 'rgba(148,163,184,0.15)',
                        }}>
                        {run.status === 'ai_complete' ? 'AI done' : run.status}
                      </span>
                    </div>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {(run.lenses as string[]).map(l => LENSES.find(x => x.key === l)?.label ?? l).join(', ')}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right panel: findings ────────────────────────────────────────── */}
        <div className="space-y-4">

          {visibleFindings.length === 0 && !isRunning && (
            <div className="rounded-xl border flex flex-col items-center justify-center py-20 text-center"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <Sparkles size={28} className="mb-3" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>No findings yet</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Select documents and lenses, then run an AI review</p>
            </div>
          )}

          {visibleFindings.length > 0 && (
            <>
              {/* Summary bar */}
              <div className="rounded-xl border px-5 py-4 grid grid-cols-4 gap-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                <div>
                  <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{visibleFindings.length}</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Total findings</p>
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: '#94a3b8' }}>{pendingCount}</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Pending review</p>
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: '#4ade80' }}>{approvedCount}</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Approved</p>
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: '#f87171' }}>{rejectedCount}</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Rejected</p>
                </div>
              </div>

              {/* Filters */}
              <div className="flex gap-1.5">
                {(['all', 'Pending', 'Approved', 'Rejected'] as const).map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: filterStatus === s ? 'var(--accent)' : 'var(--bg-surface)',
                      color: filterStatus === s ? 'white' : 'var(--text-muted)',
                      border: '1px solid var(--border)',
                    }}>
                    {s === 'all' ? 'All' : s}
                  </button>
                ))}
              </div>

              {/* Findings grouped by lens */}
              {LENSES.map(lens => {
                const lensFindings = visibleFindings.filter(f => f.lens === lens.key)
                if (!lensFindings.length) return null
                const isExpanded = expandedLenses.has(lens.key)
                const critCount = lensFindings.filter(f => f.severity === 'Critical').length
                const majCount = lensFindings.filter(f => f.severity === 'Major').length

                return (
                  <div key={lens.key} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                    {/* Lens header */}
                    <button
                      onClick={() => toggleExpandedLens(lens.key)}
                      className="w-full flex items-center justify-between px-5 py-3.5 hover:opacity-80"
                      style={{ background: 'var(--bg-surface)' }}>
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown size={14} style={{ color: lens.color }} /> : <ChevronRight size={14} style={{ color: lens.color }} />}
                        <span className="text-sm font-semibold" style={{ color: lens.color }}>{lens.label}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${lens.color}20`, color: lens.color }}>
                          {lensFindings.length} findings
                        </span>
                      </div>
                      <div className="flex gap-2 text-[10px]">
                        {critCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
                            {critCount} Critical
                          </span>
                        )}
                        {majCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c' }}>
                            {majCount} Major
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Findings list */}
                    {isExpanded && (
                      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                        {(['Critical', 'Major', 'Minor', 'Observation'] as const).map(sev => {
                          const sevFindings = lensFindings.filter(f => f.severity === sev)
                          if (!sevFindings.length) return null
                          return sevFindings.map(finding => {
                            const sev = SEVERITY_CFG[finding.severity] ?? SEVERITY_CFG.Observation
                            const statusCfg = STATUS_CFG[finding.status]
                            const isReviewing = reviewingId === finding.id

                            return (
                              <div key={finding.id} className="px-5 py-4 space-y-3" style={{ background: 'var(--bg-elevated)' }}>
                                {/* Finding header */}
                                <div className="flex items-start gap-3">
                                  <span className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold mt-0.5"
                                    style={{ background: sev.bg, color: sev.color }}>
                                    {finding.severity}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{finding.title}</p>
                                    {finding.clause_ref && (
                                      <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--accent)' }}>{finding.clause_ref}</p>
                                    )}
                                  </div>
                                  <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full flex-shrink-0"
                                    style={{ color: statusCfg.color, background: `${statusCfg.color}20` }}>
                                    {statusCfg.icon} {finding.status}
                                  </span>
                                </div>

                                {/* Description */}
                                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{finding.description}</p>

                                {/* Refs */}
                                {(finding.drawing_refs?.length > 0 || finding.document_refs?.length > 0) && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {finding.drawing_refs?.map((ref, i) => (
                                      <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded"
                                        style={{ background: 'rgba(108,114,245,0.1)', color: 'var(--accent)' }}>
                                        <FileText size={9} /> {ref}
                                      </span>
                                    ))}
                                    {finding.document_refs?.map((ref, i) => (
                                      <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded"
                                        style={{ background: 'rgba(148,163,184,0.1)', color: 'var(--text-muted)' }}>
                                        <FileText size={9} /> {ref}
                                      </span>
                                    ))}
                                    {finding.procurement_item_id && (
                                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded"
                                        style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>
                                        <ShoppingCart size={9} /> Linked to procurement
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Review action buttons */}
                                {canEdit && finding.status === 'Pending' && !isReviewing && (
                                  <div className="flex gap-2 pt-1">
                                    <button
                                      onClick={() => { setReviewingId(finding.id); setReviewingAction('Approved'); setReviewNote(''); setReviewDecisionType(''); setReviewError(null) }}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80"
                                      style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
                                      <CheckCircle2 size={11} /> Approve
                                    </button>
                                    <button
                                      onClick={() => { setReviewingId(finding.id); setReviewingAction('Rejected'); setReviewNote(''); setReviewDecisionType(''); setReviewError(null) }}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80"
                                      style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
                                      <XCircle size={11} /> Reject
                                    </button>
                                  </div>
                                )}

                                {/* Inline review form */}
                                {canEdit && isReviewing && reviewingAction && (
                                  <div className="rounded-xl border p-4 space-y-3 mt-1"
                                    style={{ background: 'var(--bg-surface)', borderColor: reviewingAction === 'Approved' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)' }}>
                                    <p className="text-xs font-semibold"
                                      style={{ color: reviewingAction === 'Approved' ? '#4ade80' : '#f87171' }}>
                                      {reviewingAction === 'Approved' ? '✓ Record Approval Decision' : '✕ Record Rejection Reason'}
                                    </p>

                                    {/* Decision type */}
                                    <div>
                                      <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                                        DECISION TYPE <span style={{ color: '#f87171' }}>*</span>
                                      </label>
                                      <select
                                        value={reviewDecisionType}
                                        onChange={e => setReviewDecisionType(e.target.value)}
                                        className="w-full rounded-lg px-3 py-2 text-xs"
                                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: reviewDecisionType ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                        <option value="">Select decision type…</option>
                                        {reviewingAction === 'Approved' ? (
                                          <>
                                            <option>Design Change Required</option>
                                            <option>Accepted as Risk</option>
                                            <option>Deferred to Later Stage</option>
                                            <option>Further Investigation Required</option>
                                          </>
                                        ) : (
                                          <>
                                            <option>Not Applicable</option>
                                            <option>AI Interpretation Error</option>
                                            <option>Duplicate Finding</option>
                                            <option>Out of Scope</option>
                                          </>
                                        )}
                                      </select>
                                    </div>

                                    {/* Comment */}
                                    <div>
                                      <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                                        {reviewingAction === 'Approved'
                                          ? 'WHAT WILL BE DONE / ACTION REQUIRED'
                                          : 'REASON FOR REJECTION'}
                                        {' '}<span style={{ color: '#f87171' }}>*</span>
                                      </label>
                                      <textarea
                                        value={reviewNote}
                                        onChange={e => setReviewNote(e.target.value)}
                                        placeholder={reviewingAction === 'Approved'
                                          ? 'Describe the action to be taken, who is responsible, and any target date…'
                                          : 'Explain why this finding does not apply or is being rejected…'}
                                        rows={3}
                                        className="w-full rounded-lg px-3 py-2 text-xs resize-none"
                                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                      />
                                    </div>

                                    {reviewError && (
                                      <p className="text-xs px-3 py-2 rounded-lg"
                                        style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
                                        {reviewError}
                                      </p>
                                    )}

                                    <div className="flex gap-2 pt-1">
                                      <button onClick={() => reviewFinding(finding.id, reviewingAction)}
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold hover:opacity-80"
                                        style={{
                                          background: reviewingAction === 'Approved' ? '#4ade80' : '#f87171',
                                          color: '#000',
                                        }}>
                                        {reviewingAction === 'Approved'
                                          ? <><CheckCircle2 size={11} /> Confirm Approval</>
                                          : <><XCircle size={11} /> Confirm Rejection</>}
                                      </button>
                                      <button onClick={() => { setReviewingId(null); setReviewingAction(null); setReviewNote(''); setReviewDecisionType(''); setReviewError(null) }}
                                        className="px-3 py-2 rounded-lg text-xs hover:opacity-80"
                                        style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Existing decision */}
                                {finding.status !== 'Pending' && (
                                  <div className="rounded-lg px-3 py-2.5 text-xs space-y-1"
                                    style={{ background: 'var(--bg-surface)', border: `1px solid ${finding.status === 'Approved' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}` }}>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-semibold" style={{ color: finding.status === 'Approved' ? '#4ade80' : '#f87171' }}>
                                        {finding.status}
                                      </p>
                                      {(finding as any).decision_type && (
                                        <span className="px-2 py-0.5 rounded text-[10px]"
                                          style={{ background: 'var(--bg-elevated)', color: 'var(--accent)', border: '1px solid var(--border)' }}>
                                          {(finding as any).decision_type}
                                        </span>
                                      )}
                                    </div>
                                    {finding.review_notes && (
                                      <p style={{ color: 'var(--text-secondary)' }}>{finding.review_notes}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
