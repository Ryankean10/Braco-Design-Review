'use client'

import { useState } from 'react'
import { MessageSquare, Send, CheckCircle2, Clock, Reply, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ClientComment } from '@/components/ClientCommentThread'

interface Props {
  projectId: string
  initialComments: ClientComment[]
}

const STATUS_CFG = {
  Open:       { color: '#fb923c', label: 'Awaiting response' },
  Responded:  { color: '#60a5fa', label: 'Response sent' },
  Closed:     { color: '#4ade80', label: 'Closed' },
}

export default function InternalCommentPanel({ projectId, initialComments }: Props) {
  const [comments, setComments] = useState<ClientComment[]>(initialComments)
  const [replyId, setReplyId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const open = comments.filter(c => c.status === 'Open')
  const rest = comments.filter(c => c.status !== 'Open')

  async function sendResponse(comment: ClientComment) {
    if (!replyText.trim()) return
    setSaving(true)
    const { data } = await supabase.from('client_comments')
      .update({
        response: replyText.trim(),
        status: 'Responded',
        responded_at: new Date().toISOString(),
      })
      .eq('id', comment.id)
      .select().single()
    if (data) setComments(prev => prev.map(c => c.id === data.id ? { ...c, ...data } : c))
    setReplyId(null)
    setReplyText('')
    setSaving(false)
  }

  async function closeComment(id: string) {
    const { data } = await supabase.from('client_comments').update({ status: 'Closed' }).eq('id', id).select().single()
    if (data) setComments(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
  }

  if (comments.length === 0) return null

  const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  function CommentRow({ c }: { c: ClientComment }) {
    const cfg = STATUS_CFG[c.status]
    return (
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: c.status === 'Open' ? 'rgba(251,146,60,0.4)' : 'var(--border)' }}>
        <div className="px-4 py-3" style={{ background: c.status === 'Open' ? 'rgba(251,146,60,0.06)' : 'var(--bg-surface)' }}>
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div>
              {c.subject_label && <p className="text-[10px] mb-0.5" style={{ color: 'var(--accent)' }}>Re: {c.subject_label}</p>}
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Client · {fmtDate(c.created_at)}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
              {c.status !== 'Closed' && (
                <button onClick={() => closeComment(c.id)} title="Close" className="p-0.5 hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
                  <X size={11} />
                </button>
              )}
            </div>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{c.comment}</p>
        </div>

        {c.response && (
          <div className="px-4 py-2 border-t text-xs" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--accent)' }}>Response · {c.responded_at ? fmtDate(c.responded_at) : ''}: </span>
            {c.response}
            {c.client_resolved && <span className="ml-2 text-[10px]" style={{ color: '#4ade80' }}>✓ Client resolved</span>}
          </div>
        )}

        {c.status === 'Open' && replyId !== c.id && (
          <div className="px-4 py-2 border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
            <button onClick={() => { setReplyId(c.id); setReplyText('') }}
              className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--accent)' }}>
              <Reply size={11} /> Reply to client
            </button>
          </div>
        )}

        {replyId === c.id && (
          <div className="px-4 py-3 border-t space-y-2" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              rows={3}
              placeholder="Write your response…"
              className="w-full rounded-lg border px-3 py-2 text-sm resize-none"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setReplyId(null)}
                className="px-3 py-1.5 rounded-lg text-xs"
                style={{ color: 'var(--text-muted)', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                Cancel
              </button>
              <button onClick={() => sendResponse(c)} disabled={saving || !replyText.trim()}
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

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: open.length > 0 ? 'rgba(251,146,60,0.4)' : 'var(--border)' }}>
      <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <MessageSquare size={14} style={{ color: open.length > 0 ? '#fb923c' : 'var(--accent)' }} />
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Client Comments</p>
        {open.length > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(251,146,60,0.2)', color: '#fb923c' }}>
            {open.length} open
          </span>
        )}
      </div>
      <div className="p-4 space-y-3" style={{ background: 'var(--bg-elevated)' }}>
        {[...open, ...rest].map(c => <CommentRow key={c.id} c={c} />)}
      </div>
    </div>
  )
}
