'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MessageSquare, Send, X, Reply, CheckCircle2, Filter, Clock, ArrowUpRight, ArrowLeft, Paperclip } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ClientComment } from '@/components/ClientCommentThread'

type Status = 'Open' | 'Responded' | 'Closed'

interface CommentWithProject extends ClientComment {
  projects?: { name: string; client: string } | null
}

const STATUS_CFG: Record<Status, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
  Open:      { color: '#fb923c', bg: 'rgba(251,146,60,0.15)', label: 'Open',      icon: <Clock size={10} /> },
  Responded: { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)', label: 'Responded', icon: <Reply size={10} /> },
  Closed:    { color: '#4ade80', bg: 'rgba(74,222,128,0.15)', label: 'Closed',    icon: <CheckCircle2 size={10} /> },
}

// ── Row defined outside parent to prevent remount on re-render ────────────────
interface RowProps {
  c: CommentWithProject
  replyId: string | null
  replyText: string
  saving: boolean
  onOpenReply: (id: string) => void
  onCancelReply: () => void
  onReplyTextChange: (v: string) => void
  onSend: (c: CommentWithProject) => void
  onClose: (id: string) => void
}

function CommentRow({ c, replyId, replyText, saving, onOpenReply, onCancelReply, onReplyTextChange, onSend, onClose }: RowProps) {
  const cfg = STATUS_CFG[c.status]
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const attachments = (c as any).comment_attachments ?? []

  return (
    <div className="rounded-xl border overflow-hidden"
      style={{ borderColor: c.status === 'Open' ? 'rgba(251,146,60,0.35)' : 'var(--border)' }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b"
        style={{ background: c.status === 'Open' ? 'rgba(251,146,60,0.05)' : 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <Link href={`/projects/${c.project_id}`}
              className="flex items-center gap-1 text-xs font-semibold hover:underline"
              style={{ color: 'var(--accent)' }}>
              {c.projects?.name ?? 'Project'}
              <ArrowUpRight size={10} />
            </Link>
            {c.subject_label && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· {c.subject_label}</span>
            )}
            <span className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
              {c.subject_type}
            </span>
          </div>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {(c as any).creator_name ?? 'Client'} · {fmtDate(c.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ color: cfg.color, background: cfg.bg }}>
            {cfg.icon}{cfg.label}
          </span>
          {c.status !== 'Closed' && (
            <button onClick={() => onClose(c.id)} title="Close" className="p-1 hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Comment text */}
      <div className="px-4 py-3" style={{ background: 'var(--bg-elevated)' }}>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{c.comment}</p>
      </div>

      {/* Existing response */}
      {c.response && (
        <div className="px-4 py-2.5 border-t text-xs" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
          <p className="font-medium mb-0.5" style={{ color: 'var(--accent)' }}>
            {(c as any).responder_name ?? 'Team'}{c.responded_at ? ` · ${fmtDate(c.responded_at)}` : ''}
          </p>
          <span style={{ color: 'var(--text-secondary)' }}>{c.response}</span>
          {c.client_resolved && (
            <span className="ml-2 text-[10px]" style={{ color: '#4ade80' }}>
              <CheckCircle2 size={10} className="inline mr-0.5" />Client resolved
            </span>
          )}
          {attachments.filter((a: any) => a.attached_to === 'response').length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {attachments.filter((a: any) => a.attached_to === 'response').map((a: any) => (
                <span key={a.id} className="flex items-center gap-1 px-2 py-0.5 rounded"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                  <Paperclip size={9} />{a.file_name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reply trigger */}
      {c.status === 'Open' && replyId !== c.id && (
        <div className="px-4 py-2 border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
          <button onClick={() => onOpenReply(c.id)}
            className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--accent)' }}>
            <Reply size={11} /> Reply to client
          </button>
        </div>
      )}

      {/* Reply form */}
      {replyId === c.id && (
        <div className="px-4 py-3 border-t space-y-2" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
          <textarea
            value={replyText}
            onChange={e => onReplyTextChange(e.target.value)}
            rows={3}
            placeholder="Write your response to the client…"
            autoFocus
            className="w-full rounded-lg border px-3 py-2 text-sm resize-none"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
          />
          <div className="flex gap-2 justify-end">
            <button onClick={onCancelReply}
              className="px-3 py-1.5 rounded-lg text-xs"
              style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
              Cancel
            </button>
            <button onClick={() => onSend(c)} disabled={saving || !replyText.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}>
              <Send size={11} />{saving ? 'Sending…' : 'Send Response'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Register page ─────────────────────────────────────────────────────────────

export default function CommentsRegisterClient({ initialComments, userId, projectFilter }: { initialComments: CommentWithProject[]; userId: string; projectFilter: string | null }) {
  const [comments, setComments] = useState<CommentWithProject[]>(initialComments)
  const [filterStatus, setFilterStatus] = useState<Status | 'All'>('All')
  const [filterType, setFilterType] = useState<string>('All')
  const [replyId, setReplyId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const filtered = comments.filter(c =>
    (filterStatus === 'All' || c.status === filterStatus) &&
    (filterType === 'All' || c.subject_type === filterType)
  )

  const counts = {
    open:      comments.filter(c => c.status === 'Open').length,
    responded: comments.filter(c => c.status === 'Responded').length,
    closed:    comments.filter(c => c.status === 'Closed').length,
  }

  async function sendResponse(c: CommentWithProject) {
    if (!replyText.trim()) return
    setSaving(true)
    const { data } = await supabase.from('client_comments')
      .update({ response: replyText.trim(), status: 'Responded', responded_by: userId, responded_at: new Date().toISOString() })
      .eq('id', c.id).select().single()
    if (data) setComments(prev => prev.map(x => x.id === data.id ? { ...x, ...data } : x))
    setReplyId(null)
    setReplyText('')
    setSaving(false)
  }

  async function closeComment(id: string) {
    const { data } = await supabase.from('client_comments').update({ status: 'Closed' }).eq('id', id).select().single()
    if (data) setComments(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
    if (replyId === id) setReplyId(null)
  }

  return (
    <div className="min-h-screen p-6 space-y-6 max-w-4xl mx-auto" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="flex items-center gap-3">
        {projectFilter && (
          <Link href={`/projects/${projectFilter}`} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
            <ArrowLeft size={16} />
          </Link>
        )}
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Comments Register</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {projectFilter
              ? `${comments[0]?.projects?.name ?? 'Project'} — client comment & response log`
              : 'All client comments across projects'}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {([
          { label: 'Open',      value: counts.open,      color: '#fb923c' },
          { label: 'Responded', value: counts.responded, color: '#60a5fa' },
          { label: 'Closed',    value: counts.closed,    color: '#4ade80' },
        ] as const).map(({ label, value, color }) => (
          <button key={label}
            onClick={() => setFilterStatus(filterStatus === label ? 'All' : label as Status)}
            className="rounded-xl border p-4 text-left hover:opacity-80 transition-opacity"
            style={{
              background: 'var(--bg-surface)',
              borderColor: filterStatus === label ? color : 'var(--border)',
            }}>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter size={13} style={{ color: 'var(--text-muted)' }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
          className="text-xs px-2.5 py-1.5 rounded-lg border"
          style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}>
          <option value="All">All statuses</option>
          <option>Open</option>
          <option>Responded</option>
          <option>Closed</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="text-xs px-2.5 py-1.5 rounded-lg border"
          style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}>
          <option value="All">All types</option>
          <option value="document">Document</option>
          <option value="test">Test</option>
          <option value="general">General</option>
        </select>
        {(filterStatus !== 'All' || filterType !== 'All') && (
          <button onClick={() => { setFilterStatus('All'); setFilterType('All') }}
            className="text-xs px-2 py-1 rounded-lg"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            Clear
          </button>
        )}
        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
          {filtered.length} of {comments.length}
        </span>
      </div>

      {/* Comments list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <MessageSquare size={28} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No comments match this filter</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <CommentRow
              key={c.id}
              c={c}
              replyId={replyId}
              replyText={replyText}
              saving={saving}
              onOpenReply={id => { setReplyId(id); setReplyText('') }}
              onCancelReply={() => setReplyId(null)}
              onReplyTextChange={setReplyText}
              onSend={sendResponse}
              onClose={closeComment}
            />
          ))}
        </div>
      )}
    </div>
  )
}
