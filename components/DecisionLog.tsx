'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, CheckCircle2, XCircle, Sparkles, ChevronDown, ChevronRight,
  FileText, Filter, Clock, AlertTriangle,
} from 'lucide-react'

const LENS_LABELS: Record<string, string> = {
  er_compliance:    'ER Compliance',
  standards:        'Standards',
  constructability: 'Constructability',
  procurement:      'Procurement',
  clash:            'Clash Detection',
}

const LENS_COLORS: Record<string, string> = {
  er_compliance:    '#60a5fa',
  standards:        '#a78bfa',
  constructability: '#fb923c',
  procurement:      '#34d399',
  clash:            '#f472b6',
}

const SEVERITY_ORDER: Record<string, number> = { Critical: 0, Major: 1, Minor: 2, Observation: 3 }

const SEVERITY_CFG: Record<string, { color: string; bg: string }> = {
  Critical:    { color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  Major:       { color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  Minor:       { color: '#facc15', bg: 'rgba(250,204,21,0.12)' },
  Observation: { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
}

const ACTION_CFG: Record<string, { color: string; icon: React.ReactNode }> = {
  Raised:    { color: '#94a3b8', icon: <Sparkles size={11} /> },
  Approved:  { color: '#4ade80', icon: <CheckCircle2 size={11} /> },
  Rejected:  { color: '#f87171', icon: <XCircle size={11} /> },
  Reopened:  { color: '#fb923c', icon: <AlertTriangle size={11} /> },
  'Note Added': { color: '#60a5fa', icon: <FileText size={11} /> },
}

interface TimelineEntry {
  id: string
  action: string
  decision_type: string | null
  comment: string | null
  actor_name: string
  actioned_at: string
}

interface Finding {
  id: string
  run_id: string | null
  lens: string
  severity: string
  title: string
  description: string
  clause_ref: string | null
  drawing_refs: string[]
  document_refs: string[]
  status: 'Pending' | 'Approved' | 'Rejected'
  decision_type: string | null
  review_notes: string | null
  reviewed_at: string | null
  reviewer_name: string
  created_at: string
  timeline: TimelineEntry[]
}

interface Props {
  projectId: string
  projectName: string
  findings: Finding[]
}

export default function DecisionLog({ projectId, projectName, findings }: Props) {
  const [filterLens, setFilterLens] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSeverity, setFilterSeverity] = useState('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Summary
  const pending  = findings.filter(f => f.status === 'Pending').length
  const approved = findings.filter(f => f.status === 'Approved').length
  const rejected = findings.filter(f => f.status === 'Rejected').length
  const designChanges = findings.filter(f => f.decision_type === 'Design Change Required').length

  const decisionBreakdown = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const f of findings) {
      if (f.decision_type) counts[f.decision_type] = (counts[f.decision_type] ?? 0) + 1
    }
    return counts
  }, [findings])

  // Available filter values
  const lenses     = [...new Set(findings.map(f => f.lens))]
  const severities = [...new Set(findings.map(f => f.severity))]

  // Filter + sort
  const filtered = useMemo(() => {
    return findings
      .filter(f => {
        if (filterLens !== 'all' && f.lens !== filterLens) return false
        if (filterStatus !== 'all' && f.status !== filterStatus) return false
        if (filterSeverity !== 'all' && f.severity !== filterSeverity) return false
        if (search && !f.title.toLowerCase().includes(search.toLowerCase()) &&
            !f.review_notes?.toLowerCase().includes(search.toLowerCase())) return false
        return true
      })
      .sort((a, b) => {
        // Pending first, then by severity
        const aP = a.status === 'Pending' ? 0 : 1
        const bP = b.status === 'Pending' ? 0 : 1
        if (aP !== bP) return aP - bP
        return (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
      })
  }, [findings, filterLens, filterStatus, filterSeverity, search])

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center gap-3"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <Link href={`/projects/${projectId}`} className="p-1.5 rounded-lg hover:opacity-70"
          style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Design Decision Log</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {projectName} — complete audit trail · {findings.length} finding{findings.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href={`/projects/${projectId}/reviews`}
          className="text-xs px-3 py-1.5 rounded-lg hover:opacity-80"
          style={{ background: 'var(--bg-elevated)', color: 'var(--accent)', border: '1px solid var(--border)' }}>
          AI Reviews →
        </Link>
      </div>

      <div className="p-6 max-w-5xl mx-auto space-y-5">

        {/* Summary */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total findings',       value: findings.length, color: 'var(--text-primary)' },
            { label: 'Awaiting sign-off',    value: pending,         color: '#fb923c' },
            { label: 'Decisions recorded',   value: approved + rejected, color: '#4ade80' },
            { label: 'Design changes raised',value: designChanges,   color: '#a78bfa' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border p-4"
              style={{ background: 'var(--bg-surface)', borderColor: s.value > 0 && s.color !== 'var(--text-primary)' ? `${s.color}40` : 'var(--border)' }}>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Decision breakdown */}
        {Object.keys(decisionBreakdown).length > 0 && (
          <div className="rounded-xl border px-5 py-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
              Decision Type Breakdown
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(decisionBreakdown).map(([type, count]) => (
                <span key={type} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                  <span className="font-bold" style={{ color: 'var(--accent)' }}>{count}</span>
                  {type}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Pending banner */}
        {pending > 0 && (
          <div className="rounded-xl border px-4 py-3 flex items-center gap-3"
            style={{ background: 'rgba(251,146,60,0.08)', borderColor: 'rgba(251,146,60,0.4)' }}>
            <Clock size={14} style={{ color: '#fb923c' }} />
            <p className="text-xs" style={{ color: '#fdba74' }}>
              <strong>{pending} finding{pending !== 1 ? 's' : ''}</strong> still awaiting human sign-off.
              Findings cannot be closed without a recorded decision.
            </p>
            <Link href={`/projects/${projectId}/reviews`}
              className="ml-auto text-xs px-3 py-1.5 rounded-lg flex-shrink-0"
              style={{ background: 'rgba(251,146,60,0.2)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.4)' }}>
              Review now →
            </Link>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <Filter size={13} style={{ color: 'var(--text-muted)' }} />
          <input type="text" placeholder="Search findings…" value={search} onChange={e => setSearch(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs flex-1 min-w-36 max-w-52"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            <option value="all">All statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
          <select value={filterLens} onChange={e => setFilterLens(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            <option value="all">All lenses</option>
            {lenses.map(l => <option key={l} value={l}>{LENS_LABELS[l] ?? l}</option>)}
          </select>
          <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            <option value="all">All severities</option>
            {severities.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
            {filtered.length} of {findings.length}
          </span>
        </div>

        {/* Finding list */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border py-16 text-center"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            {findings.length === 0 ? (
              <>
                <Sparkles size={28} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>No findings yet</p>
                <p className="text-xs mt-1 mb-3" style={{ color: 'var(--text-muted)' }}>Run an AI review to generate findings</p>
                <Link href={`/projects/${projectId}/reviews`}
                  className="inline-block text-xs px-4 py-2 rounded-lg text-white"
                  style={{ background: 'var(--accent)' }}>
                  Go to AI Reviews
                </Link>
              </>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No findings match the current filters</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(finding => {
              const isOpen = expanded.has(finding.id)
              const sev = SEVERITY_CFG[finding.severity] ?? SEVERITY_CFG.Observation
              const lensColor = LENS_COLORS[finding.lens] ?? '#94a3b8'
              const isPending = finding.status === 'Pending'

              return (
                <div key={finding.id} className="rounded-xl border overflow-hidden"
                  style={{ borderColor: isPending ? `${sev.color}50` : 'var(--border)' }}>

                  {/* Row header */}
                  <button onClick={() => toggle(finding.id)}
                    className="w-full flex items-start gap-3 px-5 py-4 text-left hover:opacity-90 transition-opacity"
                    style={{ background: isPending ? sev.bg : 'var(--bg-surface)' }}>
                    <div className="mt-0.5 flex-shrink-0">
                      {isOpen
                        ? <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} />
                        : <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* Badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                          style={{ background: sev.bg, color: sev.color }}>
                          {finding.severity}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded"
                          style={{ background: `${lensColor}18`, color: lensColor }}>
                          {LENS_LABELS[finding.lens] ?? finding.lens}
                        </span>

                        {isPending ? (
                          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold"
                            style={{ color: '#fb923c', background: 'rgba(251,146,60,0.15)' }}>
                            <Clock size={9} /> Awaiting sign-off
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold"
                            style={{
                              color: finding.status === 'Approved' ? '#4ade80' : '#f87171',
                              background: finding.status === 'Approved' ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
                            }}>
                            {finding.status === 'Approved' ? <CheckCircle2 size={9} /> : <XCircle size={9} />}
                            {finding.status}
                          </span>
                        )}

                        {finding.decision_type && !isPending && (
                          <span className="text-[10px] px-2 py-0.5 rounded"
                            style={{ background: 'var(--bg-elevated)', color: 'var(--accent)', border: '1px solid var(--border)' }}>
                            {finding.decision_type}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {finding.title}
                      </p>

                      {/* Decision summary */}
                      {!isPending && finding.review_notes && (
                        <p className="text-xs truncate max-w-lg" style={{ color: 'var(--text-muted)' }}>
                          "{finding.review_notes}"
                        </p>
                      )}

                      {/* Meta */}
                      <div className="flex gap-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        <span>Raised {new Date(finding.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        {!isPending && finding.reviewed_at && (
                          <span>Decided {new Date(finding.reviewed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} by {finding.reviewer_name}</span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expanded */}
                  {isOpen && (
                    <div className="border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>

                      {/* Finding detail */}
                      <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                          Finding Detail
                        </p>
                        {finding.clause_ref && (
                          <p className="text-[10px] font-mono mb-1.5" style={{ color: 'var(--accent)' }}>
                            {finding.clause_ref}
                          </p>
                        )}
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {finding.description}
                        </p>
                        {(finding.drawing_refs?.length > 0 || finding.document_refs?.length > 0) && (
                          <div className="flex flex-wrap gap-1.5 mt-2.5">
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
                          </div>
                        )}
                        {isPending && (
                          <Link href={`/projects/${projectId}/reviews`}
                            className="inline-flex items-center gap-1.5 mt-3 text-xs px-3 py-1.5 rounded-lg"
                            style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.3)' }}>
                            <Clock size={11} /> Record decision in AI Reviews →
                          </Link>
                        )}
                      </div>

                      {/* Audit timeline */}
                      <div className="px-5 py-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                          Audit Timeline
                        </p>
                        <div className="space-y-0">
                          {finding.timeline.map((entry, idx) => {
                            const cfg = ACTION_CFG[entry.action] ?? ACTION_CFG['Note Added']
                            const isLast = idx === finding.timeline.length - 1
                            return (
                              <div key={entry.id} className="flex gap-3">
                                <div className="flex flex-col items-center flex-shrink-0" style={{ width: 24 }}>
                                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                                    style={{ background: `${cfg.color}20`, color: cfg.color }}>
                                    {cfg.icon}
                                  </div>
                                  {!isLast && (
                                    <div className="w-px flex-1 my-1" style={{ background: 'var(--border)', minHeight: 16 }} />
                                  )}
                                </div>

                                <div className={`flex-1 ${isLast ? '' : 'pb-3'}`}>
                                  <div className="flex flex-wrap items-baseline gap-2">
                                    <span className="text-xs font-semibold" style={{ color: cfg.color }}>
                                      {entry.action}
                                    </span>
                                    {entry.decision_type && (
                                      <span className="text-[10px] px-2 py-0.5 rounded"
                                        style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                                        {entry.decision_type}
                                      </span>
                                    )}
                                    <span className="text-[10px] ml-auto" style={{ color: 'var(--text-muted)' }}>
                                      {new Date(entry.actioned_at).toLocaleString('en-GB', {
                                        day: '2-digit', month: 'short', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit',
                                      })}
                                      {' · '}{entry.actor_name}
                                    </span>
                                  </div>
                                  {entry.comment && (
                                    <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                      {entry.comment}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
