'use client'

import { useState, useEffect } from 'react'
import { Loader2, Mail, CheckCircle2, AlertCircle, Clock, HelpCircle, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'

interface InboxEmail {
  id: string
  received_at: string
  from_email: string
  from_name: string
  subject: string
  body_text: string
  status: 'pending' | 'processing' | 'processed' | 'failed' | 'ignored'
  email_type: 'timesheet' | 'holiday' | 'unknown' | null
  parsed_data: any
  error_message: string | null
  people: { name: string } | null
  linked_timesheet_id: string | null
  linked_holiday_id: string | null
}

const STATUS_CFG = {
  pending:    { label: 'Pending',    color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  icon: Clock },
  processing: { label: 'Processing', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', icon: Loader2 },
  processed:  { label: 'Processed',  color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  icon: CheckCircle2 },
  failed:     { label: 'Failed',     color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  icon: AlertCircle },
  ignored:    { label: 'Ignored',    color: '#64748b', bg: 'rgba(100,116,139,0.1)', icon: HelpCircle },
}

const TYPE_CFG = {
  timesheet: { label: 'Timesheet',        color: '#22c55e', bg: 'rgba(34,197,94,0.1)'   },
  holiday:   { label: 'Holiday request',  color: '#60a5fa', bg: 'rgba(96,165,250,0.1)'  },
  unknown:   { label: 'Unknown',          color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
}

export default function InboxTab() {
  const [emails, setEmails] = useState<InboxEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  async function load(quiet = false) {
    if (!quiet) setLoading(true); else setRefreshing(true)
    const res = await fetch('/api/admin/email-inbox?limit=100')
    if (res.ok) setEmails(await res.json())
    setLoading(false); setRefreshing(false)
  }

  useEffect(() => { load() }, [])

  function toggle(id: string) {
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  const counts = {
    total:    emails.length,
    pending:  emails.filter(e => e.status === 'pending' || e.status === 'failed').length,
    processed: emails.filter(e => e.status === 'processed').length,
    ignored:  emails.filter(e => e.status === 'ignored').length,
  }

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          {[
            { label: 'Total received', value: counts.total, color: 'var(--text-primary)' },
            { label: 'Processed',      value: counts.processed, color: '#22c55e' },
            { label: 'Needs attention', value: counts.pending, color: counts.pending > 0 ? '#ef4444' : 'var(--text-muted)' },
            { label: 'Ignored',        value: counts.ignored, color: 'var(--text-muted)' },
          ].map(s => (
            <div key={s.label}>
              <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>
        <button onClick={() => load(true)} disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs hover:opacity-70"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : emails.length === 0 ? (
        <div className="text-center py-12">
          <Mail size={28} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No emails received yet.</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            The inbox polls scotplant.ai@gmail.com every 5 minutes.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {/* Table header */}
          <div className="grid text-[10px] font-semibold uppercase tracking-wider px-4 py-2"
            style={{ gridTemplateColumns: '1fr 160px 110px 110px 80px', background: 'var(--bg-elevated)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
            <div>From / Subject</div>
            <div>Person</div>
            <div>Type</div>
            <div>Status</div>
            <div className="text-right">Received</div>
          </div>

          {emails.map(email => {
            const statusCfg = STATUS_CFG[email.status]
            const StatusIcon = statusCfg.icon
            const typeCfg = email.email_type ? TYPE_CFG[email.email_type] : null
            const isExpanded = expanded.has(email.id)
            const needsAttention = email.status === 'failed' || (email.status === 'ignored' && !email.email_type)

            return (
              <div key={email.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                <div
                  className="grid items-center px-4 py-3 cursor-pointer hover:opacity-90"
                  style={{ gridTemplateColumns: '1fr 160px 110px 110px 80px', background: needsAttention ? 'rgba(239,68,68,0.03)' : 'var(--bg-surface)' }}
                  onClick={() => toggle(email.id)}>
                  {/* From / Subject */}
                  <div className="flex items-center gap-2 min-w-0">
                    {isExpanded ? <ChevronDown size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {email.from_name || email.from_email}
                      </p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{email.subject || '(no subject)'}</p>
                    </div>
                  </div>
                  {/* Person */}
                  <div className="text-xs truncate" style={{ color: email.people ? 'var(--text-primary)' : '#ef4444' }}>
                    {email.people?.name ?? <span className="italic">Unknown sender</span>}
                  </div>
                  {/* Type */}
                  <div>
                    {typeCfg ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: typeCfg.bg, color: typeCfg.color }}>{typeCfg.label}</span>
                    ) : <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>—</span>}
                  </div>
                  {/* Status */}
                  <div>
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium w-fit"
                      style={{ background: statusCfg.bg, color: statusCfg.color }}>
                      <StatusIcon size={9} /> {statusCfg.label}
                    </span>
                  </div>
                  {/* Time */}
                  <div className="text-right text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {new Date(email.received_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    <br />
                    {new Date(email.received_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
                    <div className="flex items-center gap-4 flex-wrap text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      <span>From: <strong style={{ color: 'var(--text-primary)' }}>{email.from_email}</strong></span>
                      <span>Received: {new Date(email.received_at).toLocaleString('en-GB')}</span>
                      {email.linked_timesheet_id && <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>→ Timesheet created</span>}
                      {email.linked_holiday_id && <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa' }}>→ Holiday request created</span>}
                    </div>

                    {email.error_message && (
                      <div className="rounded-lg px-3 py-2 text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                        <strong>Error:</strong> {email.error_message}
                      </div>
                    )}

                    {email.parsed_data && (
                      <div className="rounded-lg px-3 py-2 text-xs space-y-1" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>AI extracted</p>
                        <pre className="text-[11px] overflow-x-auto" style={{ color: 'var(--text-primary)' }}>
                          {JSON.stringify(email.parsed_data, null, 2)}
                        </pre>
                      </div>
                    )}

                    {email.body_text && (
                      <div className="rounded-lg px-3 py-2" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Email body</p>
                        <pre className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-muted)', fontFamily: 'inherit' }}>
                          {email.body_text.slice(0, 600)}{email.body_text.length > 600 ? '…' : ''}
                        </pre>
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
  )
}
