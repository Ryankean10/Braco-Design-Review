'use client'

import { useState, useEffect } from 'react'
import { X, CheckCircle, Clock, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'

interface BugReport {
  id: string
  reported_at: string
  reporter_name: string | null
  reporter_email: string | null
  user_message: string
  summary: string
  suggested_actions: string[]
  status: 'open' | 'resolved'
  resolved_at: string | null
  resolved_by_name: string | null
  notes: string | null
}

interface Props {
  onClose: () => void
}

export default function BugPanel({ onClose }: Props) {
  const [bugs, setBugs] = useState<BugReport[]>([])
  const [showResolved, setShowResolved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [resolving, setResolving] = useState<string | null>(null)

  async function fetchBugs(status: 'open' | 'resolved') {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/bugs?status=${status}`)
      const data = await res.json()
      setBugs(data.bugs ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBugs(showResolved ? 'resolved' : 'open')
  }, [showResolved])

  async function resolve(id: string) {
    setResolving(id)
    try {
      await fetch(`/api/admin/bugs/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      await fetchBugs('open')
    } finally {
      setResolving(null)
    }
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="h-full overflow-y-auto flex flex-col"
        style={{ width: 480, background: '#0f172a', borderLeft: '1px solid #1e293b', boxShadow: '-20px 0 60px rgba(0,0,0,0.6)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ background: '#1e293b', borderBottom: '1px solid #334155' }}>
          <div>
            <p style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 15, margin: 0 }}>Bug Reports</p>
            <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>Admin panel · {showResolved ? 'Resolved' : 'Open'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowResolved(v => !v)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: showResolved ? '#334155' : '#1e3a5f', color: showResolved ? '#94a3b8' : '#60a5fa', border: `1px solid ${showResolved ? '#475569' : '#1e40af'}` }}
            >
              {showResolved ? 'Show open' : 'Show resolved'}
            </button>
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors">
              <X size={14} color="#94a3b8" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && bugs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <CheckCircle size={32} color="#22c55e" strokeWidth={1.5} />
              <p style={{ color: '#64748b', fontSize: 13 }}>{showResolved ? 'No resolved bugs' : 'No open bugs — all clear!'}</p>
            </div>
          )}

          {!loading && bugs.map(bug => (
            <div key={bug.id}
              className="rounded-xl overflow-hidden"
              style={{ background: '#1e293b', border: '1px solid #334155' }}
            >
              {/* Bug header */}
              <button
                className="w-full text-left px-4 py-3 flex items-start gap-3"
                onClick={() => setExpanded(expanded === bug.id ? null : bug.id)}
              >
                <AlertCircle size={14} color={bug.status === 'open' ? '#f87171' : '#22c55e'} className="mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600, margin: 0, lineHeight: 1.3 }}>{bug.summary}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span style={{ color: '#8b5cf6', fontSize: 11 }}>{bug.reporter_name ?? bug.reporter_email ?? 'Unknown'}</span>
                    <span style={{ color: '#475569', fontSize: 11 }}>·</span>
                    <Clock size={10} color="#475569" />
                    <span style={{ color: '#475569', fontSize: 11 }}>{fmt(bug.reported_at)}</span>
                  </div>
                </div>
                {expanded === bug.id ? <ChevronUp size={12} color="#475569" /> : <ChevronDown size={12} color="#475569" />}
              </button>

              {/* Expanded detail */}
              {expanded === bug.id && (
                <div style={{ borderTop: '1px solid #334155' }}>
                  <div className="p-4 space-y-3">

                    <div className="rounded-lg p-3" style={{ background: '#0f172a' }}>
                      <p style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>Reporter</p>
                      <p style={{ color: '#e2e8f0', fontSize: 12, margin: 0 }}>{bug.reporter_name ?? '—'}</p>
                      {bug.reporter_email && <p style={{ color: '#64748b', fontSize: 11, margin: '2px 0 0' }}>{bug.reporter_email}</p>}
                    </div>

                    <div className="rounded-lg p-3" style={{ background: '#0f172a' }}>
                      <p style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>Their message</p>
                      <p style={{ color: '#94a3b8', fontSize: 12, margin: 0, lineHeight: 1.6 }}>{bug.user_message}</p>
                    </div>

                    {bug.suggested_actions?.length > 0 && (
                      <div className="rounded-lg p-3" style={{ background: '#0f172a', borderLeft: '2px solid #10b981' }}>
                        <p style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>AI-suggested actions</p>
                        <ul style={{ margin: 0, paddingLeft: 14 }}>
                          {bug.suggested_actions.map((a, i) => (
                            <li key={i} style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>{a}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {bug.status === 'resolved' && (
                      <div className="rounded-lg p-3 flex items-start gap-2" style={{ background: '#0f172a', borderLeft: '2px solid #22c55e' }}>
                        <CheckCircle size={12} color="#22c55e" className="mt-0.5 shrink-0" />
                        <div>
                          <p style={{ color: '#22c55e', fontSize: 12, margin: 0, fontWeight: 600 }}>Resolved by {bug.resolved_by_name ?? '—'}</p>
                          {bug.resolved_at && <p style={{ color: '#64748b', fontSize: 11, margin: '2px 0 0' }}>{fmt(bug.resolved_at)}</p>}
                          {bug.notes && <p style={{ color: '#94a3b8', fontSize: 12, margin: '4px 0 0' }}>{bug.notes}</p>}
                        </div>
                      </div>
                    )}

                    {bug.status === 'open' && (
                      <button
                        onClick={() => resolve(bug.id)}
                        disabled={resolving === bug.id}
                        className="w-full py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                        style={{ background: '#22c55e', color: '#0f172a' }}
                      >
                        {resolving === bug.id ? 'Resolving…' : '✓ Mark resolved'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
