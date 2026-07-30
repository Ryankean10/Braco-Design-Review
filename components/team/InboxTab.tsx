'use client'

import { useState, useEffect } from 'react'
import { Loader2, Mail, CheckCircle2, AlertCircle, Clock, HelpCircle, RefreshCw, ChevronDown, ChevronRight, MessageSquare, Send, X } from 'lucide-react'

interface InboxEmail {
  id: string
  received_at: string
  from_email: string
  from_name: string
  subject: string
  body_text: string
  status: 'pending' | 'processing' | 'processed' | 'failed' | 'ignored' | 'needs_attention' | 'replied'
  email_type: 'timesheet' | 'holiday' | 'unknown' | 'staff_enquiry' | null
  parsed_data: any
  error_message: string | null
  reply_text: string | null
  reply_sent_at: string | null
  people: { name: string } | null
  linked_timesheet_id: string | null
  linked_holiday_id: string | null
}

const STATUS_CFG = {
  pending:         { label: 'Pending',         color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   icon: Clock },
  processing:      { label: 'Processing',      color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',   icon: Loader2 },
  processed:       { label: 'Processed',       color: '#22c55e', bg: 'rgba(34,197,94,0.1)',    icon: CheckCircle2 },
  failed:          { label: 'Failed',          color: '#ef4444', bg: 'rgba(239,68,68,0.1)',    icon: AlertCircle },
  ignored:         { label: 'Ignored',         color: '#64748b', bg: 'rgba(100,116,139,0.1)',  icon: HelpCircle },
  needs_attention: { label: 'Needs Attention', color: '#f97316', bg: 'rgba(249,115,22,0.12)',  icon: AlertCircle },
  replied:         { label: 'Replied',         color: '#22c55e', bg: 'rgba(34,197,94,0.1)',    icon: CheckCircle2 },
}

const TYPE_CFG = {
  timesheet:      { label: 'Timesheet',        color: '#22c55e', bg: 'rgba(34,197,94,0.1)'    },
  holiday:        { label: 'Holiday request',  color: '#60a5fa', bg: 'rgba(96,165,250,0.1)'   },
  staff_enquiry:  { label: 'Staff Enquiry',    color: '#f97316', bg: 'rgba(249,115,22,0.12)'  },
  unknown:        { label: 'Unknown',          color: '#64748b', bg: 'rgba(100,116,139,0.1)'  },
}

function ReplyDialog({ email, onClose, onSent }: { email: InboxEmail; onClose: () => void; onSent: () => void }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function send() {
    if (!text.trim()) return
    setSending(true)
    setError('')
    const res = await fetch(`/api/email-inbox/${email.id}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ replyText: text }),
    })
    if (res.ok) {
      onSent()
      onClose()
    } else {
      const d = await res.json()
      setError(d.error ?? 'Failed to send')
    }
    setSending(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-lg rounded-2xl shadow-2xl flex flex-col" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Reply to {email.from_name || email.from_email}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Re: {email.subject || '(no subject)'}</p>
          </div>
          <button onClick={onClose} className="hover:opacity-60" style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>

        {/* Original email */}
        <div className="mx-5 mt-4 rounded-lg px-3 py-2 text-xs max-h-32 overflow-y-auto" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1">Original message</p>
          <pre className="whitespace-pre-wrap" style={{ fontFamily: 'inherit' }}>
            {email.body_text?.slice(0, 500)}{(email.body_text?.length ?? 0) > 500 ? '…' : ''}
          </pre>
        </div>

        {/* Reply text area */}
        <div className="px-5 mt-3">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={6}
            placeholder="Type your reply…"
            className="w-full rounded-lg px-3 py-2 text-sm resize-none focus:outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
          {error && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border hover:opacity-70"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            Cancel
          </button>
          <button onClick={send} disabled={sending || !text.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Send reply
          </button>
        </div>
      </div>
    </div>
  )
}

export default function InboxTab() {
  const [emails, setEmails] = useState<InboxEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [replyingTo, setReplyingTo] = useState<InboxEmail | null>(null)

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

  const enquiries = emails.filter(e => e.email_type === 'staff_enquiry')
  const needsAttention = enquiries.filter(e => e.status === 'needs_attention').length

  const counts = {
    total:     emails.length,
    processed: emails.filter(e => e.status === 'processed' || e.status === 'replied').length,
    attention: emails.filter(e => e.status === 'needs_attention' || e.status === 'failed').length,
    ignored:   emails.filter(e => e.status === 'ignored').length,
  }

  return (
    <div className="space-y-6">
      {replyingTo && (
        <ReplyDialog email={replyingTo} onClose={() => setReplyingTo(null)} onSent={() => load(true)} />
      )}

      {/* Staff enquiries banner */}
      {needsAttention > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)' }}>
          <AlertCircle size={16} style={{ color: '#f97316', flexShrink: 0 }} />
          <p className="text-sm font-medium" style={{ color: '#f97316' }}>
            {needsAttention} staff {needsAttention === 1 ? 'enquiry needs' : 'enquiries need'} attention
          </p>
        </div>
      )}

      {/* Header stats */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          {[
            { label: 'Total received',  value: counts.total,     color: 'var(--text-primary)' },
            { label: 'Processed',       value: counts.processed, color: '#22c55e' },
            { label: 'Needs attention', value: counts.attention, color: counts.attention > 0 ? '#ef4444' : 'var(--text-muted)' },
            { label: 'Ignored',         value: counts.ignored,   color: 'var(--text-muted)' },
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
            The inbox polls scotplantai@yacht-gitana.com every 5 minutes.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <div className="grid text-[10px] font-semibold uppercase tracking-wider px-4 py-2"
            style={{ gridTemplateColumns: '1fr 160px 130px 130px 80px', background: 'var(--bg-elevated)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
            <div>From / Subject</div>
            <div>Person</div>
            <div>Type</div>
            <div>Status</div>
            <div className="text-right">Received</div>
          </div>

          {emails.map(email => {
            const statusCfg = STATUS_CFG[email.status] ?? STATUS_CFG.pending
            const StatusIcon = statusCfg.icon
            const typeCfg = email.email_type ? TYPE_CFG[email.email_type] : null
            const isExpanded = expanded.has(email.id)
            const isEnquiry = email.email_type === 'staff_enquiry'
            const highlight = email.status === 'needs_attention'

            return (
              <div key={email.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                <div
                  className="grid items-center px-4 py-3 cursor-pointer hover:opacity-90"
                  style={{ gridTemplateColumns: '1fr 160px 130px 130px 80px', background: highlight ? 'rgba(249,115,22,0.04)' : 'var(--bg-surface)' }}
                  onClick={() => toggle(email.id)}>
                  <div className="flex items-center gap-2 min-w-0">
                    {isExpanded ? <ChevronDown size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {email.from_name || email.from_email}
                      </p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{email.subject || '(no subject)'}</p>
                    </div>
                  </div>
                  <div className="text-xs truncate" style={{ color: email.people ? 'var(--text-primary)' : '#ef4444' }}>
                    {email.people?.name ?? <span className="italic">Unknown sender</span>}
                  </div>
                  <div>
                    {typeCfg ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: typeCfg.bg, color: typeCfg.color }}>{typeCfg.label}</span>
                    ) : <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>—</span>}
                  </div>
                  <div>
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium w-fit"
                      style={{ background: statusCfg.bg, color: statusCfg.color }}>
                      <StatusIcon size={9} /> {statusCfg.label}
                    </span>
                  </div>
                  <div className="text-right text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {new Date(email.received_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    <br />
                    {new Date(email.received_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
                    <div className="flex items-center gap-4 flex-wrap text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      <span>From: <strong style={{ color: 'var(--text-primary)' }}>{email.from_email}</strong></span>
                      <span>Received: {new Date(email.received_at).toLocaleString('en-GB')}</span>
                      {email.linked_timesheet_id && <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>→ Timesheet created</span>}
                      {email.linked_holiday_id && <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa' }}>→ Holiday request created</span>}
                    </div>

                    {/* Enquiry summary */}
                    {isEnquiry && email.parsed_data?.summary && (
                      <div className="rounded-lg px-3 py-2 text-xs" style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#f97316' }}>Enquiry summary</p>
                        <p style={{ color: 'var(--text-primary)' }}>{email.parsed_data.summary}</p>
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

                    {/* Previous reply */}
                    {email.reply_text && (
                      <div className="rounded-lg px-3 py-2 text-xs" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#22c55e' }}>
                          Reply sent {email.reply_sent_at ? new Date(email.reply_sent_at).toLocaleString('en-GB') : ''}
                        </p>
                        <pre className="whitespace-pre-wrap" style={{ color: 'var(--text-primary)', fontFamily: 'inherit' }}>{email.reply_text}</pre>
                      </div>
                    )}

                    {/* Actions */}
                    {(isEnquiry || ['needs_attention', 'failed'].includes(email.status)) && (
                      <div className="flex items-center gap-2">
                        {isEnquiry && (
                          <button
                            onClick={e => { e.stopPropagation(); setReplyingTo(email) }}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
                            style={{ background: 'var(--accent)', color: '#fff' }}>
                            <MessageSquare size={12} />
                            {email.reply_text ? 'Send another reply' : 'Reply to enquiry'}
                          </button>
                        )}
                        {['needs_attention', 'failed'].includes(email.status) && (
                          <button
                            onClick={async e => {
                              e.stopPropagation()
                              await fetch(`/api/email-inbox/${email.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: 'processed' }),
                              })
                              load(true)
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-surface)' }}>
                            <CheckCircle2 size={12} />
                            Mark as processed
                          </button>
                        )}
                      </div>
                    )}

                    {email.error_message && (
                      <div className="rounded-lg px-3 py-2 text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                        <strong>Error:</strong> {email.error_message}
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
