'use client'

import { useState } from 'react'
import { MessageSquare, Send, CheckCircle2, Clock, AlertCircle, X, Reply } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export interface ClientComment {
  id: string
  project_id: string
  subject_type: 'document' | 'test' | 'general'
  subject_id: string | null
  subject_label: string | null
  comment: string
  created_by: string
  created_at: string
  status: 'Open' | 'Responded' | 'Closed'
  response: string | null
  responded_by: string | null
  responded_at: string | null
  client_resolved: boolean
  client_resolved_at: string | null
  // Joined
  creator_name?: string
  responder_name?: string
}

const STATUS_CFG = {
  Open:       { color: '#fb923c', bg: 'rgba(251,146,60,0.15)', icon: <Clock size={10} /> },
  Responded:  { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)', icon: <Reply size={10} /> },
  Closed:     { color: '#4ade80', bg: 'rgba(74,222,128,0.15)', icon: <CheckCircle2 size={10} /> },
}

function StatusBadge({ status }: { status: ClientComment['status'] }) {
  const cfg = STATUS_CFG[status]
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ color: cfg.color, background: cfg.bg }}>
      {cfg.icon}{status}
    </span>
  )
}

// ── Single comment card ───────────────────────────────────────────────────────

function CommentCard({
  comment,
  isClient,
  canRespond,
  onUpdate,
}: {
  comment: ClientComment
  isClient: boolean
  canRespond: boolean
  onUpdate: (updated: ClientComment) => void
}) {
  const [responding, setResponding] = useState(false)
  const [responseText, setResponseText] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function submitResponse() {
    if (!responseText.trim()) return
    setSaving(true)
    const { data: profile } = await supabase.from('profiles').select('id').single()
    const { data, error } = await supabase.from('client_comments')
      .update({
        response: responseText.trim(),
        status: 'Responded',
        responded_at: new Date().toISOString(),
      })
      .eq('id', comment.id)
      .select()
      .single()
    if (!error && data) {
      onUpdate({ ...comment, ...data })
      setResponding(false)
      setResponseText('')
    }
    setSaving(false)
  }

  async function closeComment() {
    const { data } = await supabase.from('client_comments')
      .update({ status: 'Closed' })
      .eq('id', comment.id).select().single()
    if (data) onUpdate({ ...comment, ...data })
  }

  async function markResolved() {
    const { data } = await supabase.from('client_comments')
      .update({ client_resolved: true, client_resolved_at: new Date().toISOString(), status: 'Closed' })
      .eq('id', comment.id).select().single()
    if (data) onUpdate({ ...comment, ...data })
  }

  const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      {/* Comment */}
      <div className="px-4 py-3" style={{ background: 'var(--bg-surface)' }}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            {comment.subject_label && (
              <p className="text-[10px] mb-0.5" style={{ color: 'var(--text-muted)' }}>
                Re: <span style={{ color: 'var(--accent)' }}>{comment.subject_label}</span>
              </p>
            )}
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {comment.creator_name ?? 'Client'} · {fmtDate(comment.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={comment.status} />
            {canRespond && comment.status !== 'Closed' && (
              <button onClick={closeComment} title="Close" className="p-1 hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{comment.comment}</p>
      </div>

      {/* Response */}
      {comment.response && (
        <div className="px-4 py-3 border-t" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
          <p className="text-[10px] mb-1" style={{ color: 'var(--accent)' }}>
            Response · {comment.responder_name ?? 'Team'}{comment.responded_at ? ` · ${fmtDate(comment.responded_at)}` : ''}
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{comment.response}</p>
          {isClient && !comment.client_resolved && comment.status === 'Responded' && (
            <button onClick={markResolved}
              className="mt-2 flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg"
              style={{ color: '#4ade80', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)' }}>
              <CheckCircle2 size={11} /> Mark as resolved
            </button>
          )}
        </div>
      )}

      {/* Respond form (internal users) */}
      {canRespond && !responding && comment.status === 'Open' && (
        <div className="px-4 py-2 border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
          <button onClick={() => setResponding(true)}
            className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--accent)' }}>
            <Reply size={11} /> Reply
          </button>
        </div>
      )}
      {canRespond && responding && (
        <div className="px-4 py-3 border-t space-y-2" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
          <textarea
            value={responseText}
            onChange={e => setResponseText(e.target.value)}
            rows={3}
            placeholder="Write your response…"
            className="w-full rounded-lg border px-3 py-2 text-sm resize-none"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setResponding(false); setResponseText('') }}
              className="px-3 py-1.5 rounded-lg text-xs"
              style={{ color: 'var(--text-muted)', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              Cancel
            </button>
            <button onClick={submitResponse} disabled={saving || !responseText.trim()}
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

// ── Thread panel (add + list) ─────────────────────────────────────────────────

interface Props {
  projectId: string
  subjectType: 'document' | 'test' | 'general'
  subjectId?: string
  subjectLabel?: string
  initialComments: ClientComment[]
  isClient: boolean
  canRespond: boolean
}

export default function ClientCommentThread({
  projectId, subjectType, subjectId, subjectLabel,
  initialComments, isClient, canRespond,
}: Props) {
  const [comments, setComments] = useState<ClientComment[]>(initialComments)
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const supabase = createClient()

  const openCount = comments.filter(c => c.status === 'Open').length

  async function submit() {
    if (!text.trim()) return
    setSaving(true)
    setSubmitError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSubmitError('Not authenticated'); setSaving(false); return }
    const { data, error } = await supabase.from('client_comments')
      .insert([{
        project_id: projectId,
        subject_type: subjectType,
        subject_id: subjectId ?? null,
        subject_label: subjectLabel ?? null,
        comment: text.trim(),
        created_by: user.id,
      }])
      .select()
      .single()
    if (error) { setSubmitError(error.message); setSaving(false); return }
    if (data) {
      setComments(prev => [data, ...prev])
      setText('')
      setOpen(false)
    }
    setSaving(false)
  }

  function updateComment(updated: ClientComment) {
    setComments(prev => prev.map(c => c.id === updated.id ? updated : c))
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <button onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 text-xs"
          style={{ color: 'var(--text-muted)' }}>
          <MessageSquare size={13} style={{ color: openCount > 0 ? '#fb923c' : 'var(--text-muted)' }} />
          <span>
            {comments.length === 0 ? (isClient ? 'Add a comment' : 'No comments') : `${comments.length} comment${comments.length !== 1 ? 's' : ''}`}
          </span>
          {openCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: 'rgba(251,146,60,0.2)', color: '#fb923c' }}>
              {openCount} open
            </span>
          )}
        </button>
        {isClient && !open && (
          <button onClick={() => setOpen(true)}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg"
            style={{ color: 'var(--accent)', background: 'rgba(108,114,245,0.1)', border: '1px solid rgba(108,114,245,0.2)' }}>
            <MessageSquare size={11} /> Comment
          </button>
        )}
      </div>

      {/* Add comment form */}
      {open && isClient && (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={3}
            placeholder={`Your comment on ${subjectLabel ?? 'this project'}…`}
            className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setOpen(false); setText('') }}
              className="px-3 py-1.5 rounded-lg text-xs"
              style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
              Cancel
            </button>
            <button onClick={submit} disabled={saving || !text.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, var(--accent), #a855f7)' }}>
              <Send size={11} />{saving ? 'Sending…' : 'Submit Comment'}
            </button>
          </div>
          {submitError && (
            <p className="text-xs px-1" style={{ color: '#f87171' }}>{submitError}</p>
          )}
        </div>
      )}

      {/* Comments list */}
      {(open || comments.length > 0) && comments.length > 0 && (
        <div className="space-y-2">
          {comments.map(c => (
            <CommentCard key={c.id} comment={c} isClient={isClient} canRespond={canRespond} onUpdate={updateComment} />
          ))}
        </div>
      )}
    </div>
  )
}
