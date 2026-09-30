'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Clock, ChevronDown, ChevronRight } from 'lucide-react'

interface DayEntry {
  date: string
  hours_on_site: number
  driving_hours: number
  working_location: string
  comments: string
}

interface Submission {
  id: string
  submitted_name: string
  matched_name: string | null
  match_confidence: 'high' | 'medium' | 'low' | 'unmatched' | null
  week_starting: string
  days: DayEntry[]
  total_hours: number
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  submitted_at: string
}

interface Props {
  initialSubmissions: Submission[]
  companyId: string
}

const CONF: Record<string, { label: string; color: string }> = {
  high:      { label: 'Matched',        color: '#16a34a' },
  medium:    { label: 'Likely match',   color: '#ca8a04' },
  low:       { label: 'Possible match', color: '#ea580c' },
  unmatched: { label: 'Unmatched',      color: '#dc2626' },
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function fmtWeek(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  const sun = new Date(d); sun.setDate(sun.getDate() + 6)
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${sun.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function fmtDt(dt: string) {
  return new Date(dt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function TimesheetApprovalClient({ initialSubmissions, companyId }: Props) {
  const [submissions, setSubmissions] = useState<Submission[]>(initialSubmissions)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [loading, setLoading] = useState<string | null>(null)

  const filtered = submissions.filter(s => filter === 'all' || s.status === filter)
  const pendingCount = submissions.filter(s => s.status === 'pending').length

  function toggleExpand(id: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function approve(id: string) {
    setLoading(id)
    const res = await fetch(`/api/timesheets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })
    if (res.ok) setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: 'approved' } : s))
    setLoading(null)
  }

  async function reject(id: string) {
    setLoading(id)
    const res = await fetch(`/api/timesheets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected', rejection_reason: rejectReason.trim() || null }),
    })
    if (res.ok) {
      setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: 'rejected', rejection_reason: rejectReason.trim() } : s))
      setRejectId(null); setRejectReason('')
    }
    setLoading(null)
  }

  return (
    <div>
      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--border)'}`, background: filter === f ? 'var(--accent)' : 'var(--bg-elevated)', color: filter === f ? '#fff' : 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'pending' && pendingCount > 0 && (
              <span style={{ background: '#dc2626', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 11 }}>{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <Clock size={40} style={{ margin: '0 auto 12px', opacity: 0.4, display: 'block' }} />
          <p>No {filter === 'all' ? '' : filter} submissions</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(sub => {
          const isExpanded = expanded.has(sub.id)
          const conf = sub.match_confidence
          const confInfo = conf ? CONF[conf] : null
          const activeDays = (sub.days ?? []).filter(d => d.hours_on_site > 0 || d.driving_hours > 0)
          const statusMap = { pending: { label: 'Pending', color: '#ca8a04', bg: '#fefce8' }, approved: { label: 'Approved', color: '#16a34a', bg: '#f0fdf4' }, rejected: { label: 'Rejected', color: '#dc2626', bg: '#fef2f2' } }
          const st = statusMap[sub.status]

          return (
            <div key={sub.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {/* Header row */}
              <div style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }} onClick={() => toggleExpand(sub.id)}>
                <div style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>{sub.submitted_name}</span>
                    {confInfo && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: confInfo.color, background: confInfo.color + '18', padding: '2px 7px', borderRadius: 4 }}>
                        {sub.matched_name ? `→ ${sub.matched_name}` : confInfo.label}
                      </span>
                    )}
                    <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, padding: '2px 8px', borderRadius: 4, border: `1px solid ${st.color}40` }}>{st.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span>{fmtWeek(sub.week_starting)}</span>
                    <span>·</span>
                    <span>{activeDays.length} day{activeDays.length !== 1 ? 's' : ''}</span>
                    <span>·</span>
                    <span>{sub.total_hours}h total</span>
                    <span>·</span>
                    <span>Submitted {fmtDt(sub.submitted_at)}</span>
                  </div>
                </div>
                {sub.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button disabled={loading === sub.id} onClick={() => approve(sub.id)}
                      style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}>
                      <CheckCircle size={14} /> Approve
                    </button>
                    <button disabled={loading === sub.id} onClick={() => { setRejectId(sub.id); setRejectReason('') }}
                      style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}>
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                )}
              </div>

              {/* Expanded day breakdown */}
              {isExpanded && activeDays.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '90px 70px 70px 1fr 1fr', gap: 6, marginBottom: 6 }}>
                    {['Day', 'On site', 'Driving', 'Location', 'Notes'].map(h => (
                      <span key={h} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</span>
                    ))}
                  </div>
                  {activeDays.map(day => (
                    <div key={day.date} style={{ display: 'grid', gridTemplateColumns: '90px 70px 70px 1fr 1fr', gap: 6, padding: '5px 0', borderTop: '1px solid var(--bg-elevated)' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{fmtDate(day.date)}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{day.hours_on_site}h</span>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{day.driving_hours > 0 ? `${day.driving_hours}h` : '—'}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{day.working_location || '—'}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{day.comments || '—'}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Rejection reason */}
              {sub.rejection_reason && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '8px 16px', background: '#fef2f2' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#dc2626' }}>Rejection reason: </span>
                  <span style={{ fontSize: 13, color: '#dc2626' }}>{sub.rejection_reason}</span>
                </div>
              )}

              {/* Reject input */}
              {rejectId === sub.id && (
                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                  <textarea autoFocus value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2}
                    placeholder="Reason for rejection (optional)"
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--bg-base)', color: 'var(--text-primary)', resize: 'vertical', boxSizing: 'border-box', marginBottom: 8 }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => reject(sub.id)} disabled={loading === sub.id}
                      style={{ padding: '6px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      Confirm reject
                    </button>
                    <button onClick={() => { setRejectId(null); setRejectReason('') }}
                      style={{ padding: '6px 14px', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
