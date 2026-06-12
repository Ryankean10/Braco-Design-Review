'use client'

import { useState } from 'react'
import { MessageSquare, Send, X, Reply, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ClientComment } from '@/components/ClientCommentThread'

const STATUS_CFG = {
  Open:       { color: '#fb923c', label: 'Awaiting response' },
  Responded:  { color: '#60a5fa', label: 'Response sent' },
  Closed:     { color: '#4ade80', label: 'Closed' },
}

// ── Defined OUTSIDE the parent so React never remounts it on re-render ────────
interface RowProps {
  c: ClientComment
  replyId: string | null
  replyText: string
  saving: boolean
  onOpenReply: (id: string) => void
  onCancelReply: () => void
  onReplyTextChange: (v: string) => void
  onSend: (c: ClientComment) => void
  onClose: (id: string) => void
}

function CommentRow({ c, replyId, replyText, saving, onOpenReply, onCancelReply, onReplyTextChange, onSend, onClose }: RowProps) {
  const cfg = STATUS_CFG[c.status]
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="rounded-xl border overflow-hidden"
      style={{ borderColor: c.status === 'Open' ? 'rgba(251,146,60,0.4)' : 'var(--border)' }}>

      {/* Comment body */}
      <div className="px-4 py-3" style={{ background: c.status === 'Open' ? 'rgba(251,146,60,0.06)' : 'var(--bg-surface)' }}>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div>
            {c.subject_label && (
              <p className="text-[10px] mb-0.5" style={{ color: 'var(--accent)' }}>Re: {c.subject_label}</p>
            )}
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Client · {fmtDate(c.created_at)}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ color: cfg.color, background: `${cfg.color}20` }}>
              {cfg.label}
            </span>
            {c.status !== 'Closed' && (
              <button onClick={() => onClose(c.id)} title="Close" className="p-0.5 hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
                <X size={11} />
              </button>
            )}
          </div>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{c.comment}</p>
      </div>

      {/* Existing response */}
      {c.response && (
        <div className="px-4 py-2.5 border-t text-xs" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
          <span style={{ color: 'var(--accent)' }}>
            Response{c.responded_at ? ` · ${fmtDate(c.responded_at)}` : ''}:
          </span>
          <span style={{ color: 'var(--text-secondary)' }}> {c.response}</span>
          {c.client_resolved && (
            <span className="ml-2 text-[10px]" style={{ color: '#4ade80' }}>
              <CheckCircle2 size={10} className="inline mr-0.5" />Client resolved
            </span>
          )}
        </div>
      )}

      {/* Reply trigger */}
      {c.status === 'Open' && replyId !== c.id && (
        <div className="px-4 py-2 border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
          <button onClick={() => onOpenReply(c.id)}
            className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--accent)' }}>
            <Reply size={11} /> Reply to client
          </button>
        </div>
      )}

      {/* Reply form — only shown for this row */}
      {replyId === c.id && (
        <div className="px-4 py-3 border-t space-y-2" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
          <textarea
            value={replyText}
            onChange={e => onReplyTextChange(e.target.value)}
            rows={3}
            placeholder="Write your response…"
            autoFocus
            className="w-full rounded-lg border px-3 py-2 text-sm resize-none"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
          />
          <div className="flex gap-2 justify-end">
            <button onClick={onCancelReply}
              className="px-3 py-1.5 rounded-lg text-xs"
              style={{ color: 'var(--text-muted)', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
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

// ── Parent panel ──────────────────────────────────────────────────────────────

interface Props {
  projectId: string
  initialComments: ClientComment[]
}

export default function InternalCommentPanel({ projectId, initialComments }: Props) {
  const [comments, setComments] = useState<ClientComment[]>(initialComments)
  const [replyId, setReplyId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const open = comments.filter(c => c.status === 'Open')
  const rest = comments.filter(c => c.status !== 'Open')

  async function sendResponse(c: ClientComment) {
    if (!replyText.trim()) return
    setSaving(true)
    const { data } = await supabase.from('client_comments')
      .update({ response: replyText.trim(), status: 'Responded', responded_at: new Date().toISOString() })
      .eq('id', c.id).select().single()
    if (data) setComments(prev => prev.map(x => x.id === data.id ? { ...x, ...data } : x))
    setReplyId(null)
    setReplyText('')
    setSaving(false)
  }

  async function closeComment(id: string) {
    const { data } = await supabase.from('client_comments').update({ status: 'Closed' }).eq('id', id).select().single()
    if (data) setComments(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
  }

  if (comments.length === 0) return null

  return (
    <div className="rounded-xl border overflow-hidden"
      style={{ borderColor: open.length > 0 ? 'rgba(251,146,60,0.4)' : 'var(--border)' }}>
      <div className="flex items-center gap-2 px-5 py-3 border-b"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <MessageSquare size={14} style={{ color: open.length > 0 ? '#fb923c' : 'var(--accent)' }} />
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Client Comments</p>
        {open.length > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{ background: 'rgba(251,146,60,0.2)', color: '#fb923c' }}>
            {open.length} open
          </span>
        )}
      </div>
      <div className="p-4 space-y-3" style={{ background: 'var(--bg-elevated)' }}>
        {[...open, ...rest].map(c => (
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
    </div>
  )
}
