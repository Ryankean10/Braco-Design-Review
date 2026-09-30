'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Clock, User, MapPin, Car, ChevronDown, ChevronRight } from 'lucide-react'

interface Submission {
  id: string
  submitted_name: string
  matched_name: string | null
  match_confidence: 'high' | 'medium' | 'low' | 'unmatched' | null
  work_date: string
  hours_on_site: number
  driving_hours: number
  working_location: string
  comments: string | null
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  submitted_at: string
}

interface Props {
  initialSubmissions: Submission[]
  companyId: string
}

const CONFIDENCE_LABELS: Record<string, { label: string; color: string }> = {
  high:      { label: 'Matched',        color: '#16a34a' },
  medium:    { label: 'Likely match',   color: '#ca8a04' },
  low:       { label: 'Possible match', color: '#ea580c' },
  unmatched: { label: 'Unmatched',      color: '#dc2626' },
}

function ConfidenceBadge({ conf, matchedName }: { conf: string | null; matchedName: string | null }) {
  if (!conf) return null
  const info = CONFIDENCE_LABELS[conf] ?? { label: conf, color: '#64748b' }
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: info.color, background: info.color + '18', padding: '2px 7px', borderRadius: 4 }}>
      {matchedName ? `→ ${matchedName}` : info.label}
    </span>
  )
}

function StatusBadge({ status }: { status: Submission['status'] }) {
  const map = {
    pending:  { label: 'Pending',  color: '#ca8a04', bg: '#fefce8' },
    approved: { label: 'Approved', color: '#16a34a', bg: '#f0fdf4' },
    rejected: { label: 'Rejected', color: '#dc2626', bg: '#fef2f2' },
  }
  const s = map[status]
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: s.color, background: s.bg, padding: '2px 8px', borderRadius: 4, border: `1px solid ${s.color}40` }}>
      {s.label}
    </span>
  )
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
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

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  async function approve(id: string) {
    setLoading(id)
    const res = await fetch(`/api/timesheets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })
    if (res.ok) {
      setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: 'approved' } : s))
    }
    setLoading(null)
  }

  async function reject(id: string) {
    if (!rejectReason.trim()) return
    setLoading(id)
    const res = await fetch(`/api/timesheets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected', rejection_reason: rejectReason.trim() }),
    })
    if (res.ok) {
      setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: 'rejected', rejection_reason: rejectReason.trim() } : s))
      setRejectId(null)
      setRejectReason('')
    }
    setLoading(null)
  }

  const pendingCount = submissions.filter(s => s.status === 'pending').length

  return (
    <div>
      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--border)'}`,
              background: filter === f ? 'var(--accent)' : 'var(--bg-elevated)',
              color: filter === f ? '#fff' : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'pending' && pendingCount > 0 && (
              <span style={{ background: '#dc2626', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 11 }}>
                {pendingCount}
              </span>
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
          return (
            <div
              key={sub.id}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                overflow: 'hidden',
              }}
            >
              {/* Row header */}
              <div
                style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                onClick={() => toggleExpand(sub.id)}
              >
                <div style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>
                      {sub.submitted_name}
                    </span>
                    <ConfidenceBadge conf={sub.match_confidence} matchedName={sub.matched_name} />
                    <StatusBadge status={sub.status} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span>{fmt(sub.work_date)}</span>
                    <span>·</span>
                    <span>{sub.hours_on_site}h on site</span>
                    {sub.driving_hours > 0 && <><span>·</span><span>{sub.driving_hours}h driving</span></>}
                    <span>·</span>
                    <span>{sub.working_location}</span>
                  </div>
                </div>

                {sub.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button
                      title="Approve"
                      disabled={loading === sub.id}
                      onClick={() => approve(sub.id)}
                      style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}
                    >
                      <CheckCircle size={14} /> Approve
                    </button>
                    <button
                      title="Reject"
                      disabled={loading === sub.id}
                      onClick={() => { setRejectId(sub.id); setRejectReason('') }}
                      style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}
                    >
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                )}
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div style={{ padding: '0 16px 14px 42px', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                    <Detail icon={<User size={13} />} label="Submitted name" value={sub.submitted_name} />
                    {sub.matched_name && <Detail icon={<User size={13} />} label="Matched to" value={sub.matched_name} />}
                    <Detail icon={<Clock size={13} />} label="Hours on site" value={`${sub.hours_on_site}h`} />
                    {sub.driving_hours > 0 && <Detail icon={<Car size={13} />} label="Driving hours" value={`${sub.driving_hours}h`} />}
                    <Detail icon={<MapPin size={13} />} label="Location" value={sub.working_location} />
                    <Detail icon={<Clock size={13} />} label="Submitted" value={fmtDt(sub.submitted_at)} />
                  </div>
                  {sub.comments && (
                    <div style={{ marginTop: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Comments</span>
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-primary)' }}>{sub.comments}</p>
                    </div>
                  )}
                  {sub.rejection_reason && (
                    <div style={{ marginTop: 10, background: '#fef2f2', borderRadius: 6, padding: '8px 12px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#dc2626' }}>Rejection reason</span>
                      <p style={{ margin: '2px 0 0', fontSize: 13, color: '#dc2626' }}>{sub.rejection_reason}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Reject reason input */}
              {rejectId === sub.id && (
                <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    Reason for rejection (optional)
                  </label>
                  <textarea
                    autoFocus
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    rows={2}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--bg-base)', color: 'var(--text-primary)', resize: 'vertical', boxSizing: 'border-box' }}
                    placeholder="Optional — will be recorded"
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      onClick={() => reject(sub.id)}
                      disabled={loading === sub.id}
                      style={{ padding: '6px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Confirm reject
                    </button>
                    <button
                      onClick={() => { setRejectId(null); setRejectReason('') }}
                      style={{ padding: '6px 14px', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
                    >
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

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', marginBottom: 2 }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}
