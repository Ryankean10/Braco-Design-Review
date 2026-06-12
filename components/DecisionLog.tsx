'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, XCircle, Sparkles, ChevronDown, ChevronRight, FileText, Filter } from 'lucide-react'

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

const SEVERITY_CFG: Record<string, { color: string; bg: string }> = {
  Critical:    { color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  Major:       { color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  Minor:       { color: '#facc15', bg: 'rgba(250,204,21,0.12)' },
  Observation: { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
}

const ACTION_CFG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  Raised:    { color: '#94a3b8', icon: <Sparkles size={11} />,     label: 'Raised by AI' },
  Approved:  { color: '#4ade80', icon: <CheckCircle2 size={11} />, label: 'Approved' },
  Rejected:  { color: '#f87171', icon: <XCircle size={11} />,      label: 'Rejected' },
  Reopened:  { color: '#fb923c', icon: <ChevronDown size={11} />,  label: 'Reopened' },
  'Note Added': { color: '#60a5fa', icon: <FileText size={11} />,  label: 'Note Added' },
}

interface LogEntry {
  id: string
  finding_id: string
  run_id: string | null
  lens: string
  finding_title: string
  severity: string
  action: string
  decision_type: string | null
  comment: string | null
  actioned_at: string
  actor_name: string
  finding: {
    description: string
    clause_ref: string | null
    drawing_refs: string[]
    document_refs: string[]
    status: string
    decision_type: string | null
    review_notes: string | null
  } | null
  run: { run_at: string } | null
}

interface Props {
  projectId: string
  projectName: string
  entries: LogEntry[]
}

export default function DecisionLog({ projectId, projectName, entries }: Props) {
  const [filterLens, setFilterLens] = useState<string>('all')
  const [filterAction, setFilterAction] = useState<string>('all')
  const [filterSeverity, setFilterSeverity] = useState<string>('all')
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  // Group entries by finding_id so we show each finding once with its full history
  const findingGroups = useMemo(() => {
    const groups: Record<string, LogEntry[]> = {}
    for (const e of entries) {
      if (!groups[e.finding_id]) groups[e.finding_id] = []
      groups[e.finding_id].push(e)
    }
    // Sort each group oldest first (for timeline)
    for (const id in groups) {
      groups[id].sort((a, b) => new Date(a.actioned_at).getTime() - new Date(b.actioned_at).getTime())
    }
    return groups
  }, [entries])

  // Summary counts
  const totalFindings = Object.keys(findingGroups).length
  const resolved = Object.values(findingGroups).filter(g => {
    const last = g[g.length - 1]
    return last.action === 'Approved' || last.action === 'Rejected'
  }).length
  const pending = totalFindings - resolved
  const decisionTypes = entries
    .filter(e => e.decision_type)
    .reduce<Record<string, number>>((acc, e) => {
      acc[e.decision_type!] = (acc[e.decision_type!] ?? 0) + 1
      return acc
    }, {})

  // Filter
  const filtered = Object.entries(findingGroups).filter(([, group]) => {
    const latest = group[group.length - 1]
    if (filterLens !== 'all' && latest.lens !== filterLens) return false
    if (filterAction !== 'all' && latest.action !== filterAction) return false
    if (filterSeverity !== 'all' && latest.severity !== filterSeverity) return false
    if (search && !latest.finding_title.toLowerCase().includes(search.toLowerCase()) &&
        !latest.comment?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Sort: unresolved first, then by severity
  const SEV_ORDER: Record<string, number> = { Critical: 0, Major: 1, Minor: 2, Observation: 3 }
  filtered.sort(([, a], [, b]) => {
    const aLast = a[a.length - 1]
    const bLast = b[b.length - 1]
    const aResolved = aLast.action === 'Approved' || aLast.action === 'Rejected' ? 1 : 0
    const bResolved = bLast.action === 'Approved' || bLast.action === 'Rejected' ? 1 : 0
    if (aResolved !== bResolved) return aResolved - bResolved
    return (SEV_ORDER[aLast.severity] ?? 9) - (SEV_ORDER[bLast.severity] ?? 9)
  })

  function toggleFinding(id: string) {
    setExpandedFindings(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const lenses = [...new Set(entries.map(e => e.lens))]
  const actions = [...new Set(entries.map(e => e.action))]
  const severities = [...new Set(entries.map(e => e.severity))]

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center gap-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <Link href={`/projects/${projectId}`} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Design Decision Log</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{projectName} — full audit trail of all findings and decisions</p>
        </div>
        <Link href={`/projects/${projectId}/reviews`}
          className="text-xs px-3 py-1.5 rounded-lg hover:opacity-80"
          style={{ background: 'var(--bg-elevated)', color: 'var(--accent)', border: '1px solid var(--border)' }}>
          ← Back to Reviews
        </Link>
      </div>

      <div className="p-6 max-w-5xl mx-auto space-y-5">

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-xl border p-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{totalFindings}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Total findings raised</p>
          </div>
          <div className="rounded-xl border p-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <p className="text-2xl font-bold" style={{ color: '#fb923c' }}>{pending}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Pending decision</p>
          </div>
          <div className="rounded-xl border p-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <p className="text-2xl font-bold" style={{ color: '#4ade80' }}>{resolved}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Decisions recorded</p>
          </div>
          <div className="rounded-xl border p-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <p className="text-2xl font-bold" style={{ color: '#a78bfa' }}>
              {decisionTypes['Design Change Required'] ?? 0}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Design changes required</p>
          </div>
        </div>

        {/* Decision type breakdown */}
        {Object.keys(decisionTypes).length > 0 && (
          <div className="rounded-xl border px-5 py-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>DECISIONS BREAKDOWN</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(decisionTypes).map(([type, count]) => (
                <span key={type} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                  <span className="font-bold" style={{ color: 'var(--accent)' }}>{count}</span>
                  {type}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <Filter size={13} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search findings…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs flex-1 min-w-40 max-w-56"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
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
          <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            <option value="all">All statuses</option>
            {actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
            {filtered.length} of {totalFindings} findings
          </span>
        </div>

        {/* Finding cards */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border py-16 text-center" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No findings yet. Run an AI review to begin.</p>
            <Link href={`/projects/${projectId}/reviews`}
              className="inline-block mt-3 text-xs px-4 py-2 rounded-lg text-white"
              style={{ background: 'var(--accent)' }}>
              Go to AI Reviews
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(([findingId, group]) => {
              const latest = group[group.length - 1]
              const isExpanded = expandedFindings.has(findingId)
              const sev = SEVERITY_CFG[latest.severity] ?? SEVERITY_CFG.Observation
              const lensColor = LENS_COLORS[latest.lens] ?? '#94a3b8'
              const actionCfg = ACTION_CFG[latest.action] ?? ACTION_CFG['Note Added']
              const hasDecision = latest.action === 'Approved' || latest.action === 'Rejected'

              return (
                <div key={findingId} className="rounded-xl border overflow-hidden"
                  style={{ borderColor: hasDecision ? 'var(--border)' : `${sev.color}40` }}>

                  {/* Finding header row */}
                  <button onClick={() => toggleFinding(findingId)}
                    className="w-full flex items-start gap-3 px-5 py-4 text-left hover:opacity-90"
                    style={{ background: hasDecision ? 'var(--bg-surface)' : `${sev.bg}` }}>

                    <div className="flex-shrink-0 mt-0.5">
                      {isExpanded
                        ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
                        : <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                          style={{ background: sev.bg, color: sev.color }}>
                          {latest.severity}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded"
                          style={{ background: `${lensColor}15`, color: lensColor }}>
                          {LENS_LABELS[latest.lens] ?? latest.lens}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ color: actionCfg.color, background: `${actionCfg.color}18` }}>
                          {actionCfg.icon} {actionCfg.label}
                        </span>
                      </div>

                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {latest.finding_title}
                      </p>

                      {/* Latest decision summary */}
                      {hasDecision && (
                        <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {latest.decision_type && (
                            <span className="font-medium" style={{ color: 'var(--accent)' }}>
                              {latest.decision_type}
                            </span>
                          )}
                          {latest.comment && (
                            <span className="truncate max-w-sm" style={{ color: 'var(--text-secondary)' }}>
                              "{latest.comment}"
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        <span>{group.length} log {group.length === 1 ? 'entry' : 'entries'}</span>
                        <span>Last updated {new Date(latest.actioned_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        <span>by {latest.actor_name}</span>
                      </div>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>

                      {/* Finding description */}
                      {latest.finding?.description && (
                        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                            Finding Detail
                          </p>
                          {latest.finding.clause_ref && (
                            <p className="text-[10px] font-mono mb-1" style={{ color: 'var(--accent)' }}>
                              {latest.finding.clause_ref}
                            </p>
                          )}
                          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            {latest.finding.description}
                          </p>
                          {((latest.finding.drawing_refs?.length ?? 0) > 0 || (latest.finding.document_refs?.length ?? 0) > 0) && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {latest.finding.drawing_refs?.map((ref, i) => (
                                <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded"
                                  style={{ background: 'rgba(108,114,245,0.1)', color: 'var(--accent)' }}>
                                  <FileText size={9} /> {ref}
                                </span>
                              ))}
                              {latest.finding.document_refs?.map((ref, i) => (
                                <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded"
                                  style={{ background: 'rgba(148,163,184,0.1)', color: 'var(--text-muted)' }}>
                                  <FileText size={9} /> {ref}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Audit timeline */}
                      <div className="px-5 py-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                          Decision Timeline
                        </p>
                        <div className="space-y-3">
                          {group.map((entry, idx) => {
                            const cfg = ACTION_CFG[entry.action] ?? ACTION_CFG['Note Added']
                            return (
                              <div key={entry.id} className="flex gap-3">
                                {/* Timeline line */}
                                <div className="flex flex-col items-center flex-shrink-0">
                                  <div className="w-6 h-6 rounded-full flex items-center justify-center"
                                    style={{ background: `${cfg.color}20`, color: cfg.color }}>
                                    {cfg.icon}
                                  </div>
                                  {idx < group.length - 1 && (
                                    <div className="w-px flex-1 mt-1" style={{ background: 'var(--border)', minHeight: 12 }} />
                                  )}
                                </div>

                                <div className="flex-1 pb-2">
                                  <div className="flex items-baseline gap-2 flex-wrap">
                                    <span className="text-xs font-semibold" style={{ color: cfg.color }}>
                                      {cfg.label}
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
                                        hour: '2-digit', minute: '2-digit'
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
