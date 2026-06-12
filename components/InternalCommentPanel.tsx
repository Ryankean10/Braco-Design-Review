'use client'

import { useState, useRef } from 'react'
import { MessageSquare, Send, X, Reply, CheckCircle2, Paperclip, Download, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export interface CommentAttachment {
  id: string
  comment_id: string
  storage_path: string
  file_name: string
  file_size: number | null
  attached_to: 'comment' | 'response'
  uploaded_by: string | null
  uploaded_at: string
}

export interface FullComment {
  id: string
  project_id: string
  subject_type: string
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
  creator_name?: string | null
  responder_name?: string | null
  comment_attachments?: CommentAttachment[]
}

const STATUS_CFG = {
  Open:      { color: '#fb923c', bg: 'rgba(251,146,60,0.15)', label: 'Open' },
  Responded: { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)', label: 'Responded' },
  Closed:    { color: '#4ade80', bg: 'rgba(74,222,128,0.15)', label: 'Closed' },
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

function formatBytes(b: number | null) {
  if (!b) return ''
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

// ── Attachment list ───────────────────────────────────────────────────────────

function AttachmentList({ attachments, which, commentId, onDelete }: {
  attachments: CommentAttachment[]
  which: 'comment' | 'response'
  commentId: string
  onDelete: (id: string) => void
}) {
  const supabase = createClient()
  const list = attachments.filter(a => a.attached_to === which)
  if (list.length === 0) return null

  async function download(a: CommentAttachment) {
    const { data } = await supabase.storage.from('documents').createSignedUrl(a.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {list.map(a => (
        <div key={a.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px]"
          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          <Paperclip size={10} style={{ color: 'var(--accent)' }} />
          <span className="max-w-[120px] truncate">{a.file_name}</span>
          {a.file_size && <span>({formatBytes(a.file_size)})</span>}
          <button onClick={() => download(a)} className="hover:opacity-70" title="Download">
            <Download size={10} />
          </button>
          <button onClick={() => onDelete(a.id)} className="hover:opacity-70" title="Remove" style={{ color: '#f87171' }}>
            <Trash2 size={10} />
          </button>
        </div>
      ))}
    </div>
  )
}

// ── File upload widget ────────────────────────────────────────────────────────

function AttachButton({ commentId, which, onUploaded, userId }: {
  commentId: string
  which: 'comment' | 'response'
  userId: string
  onUploaded: (a: CommentAttachment) => void
}) {
  const [uploading, setUploading] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  async function upload(file: File) {
    setUploading(true)
    const path = `comments/${commentId}/${which}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`
    const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: false })
    if (upErr) { alert(upErr.message); setUploading(false); return }
    const { data } = await supabase.from('comment_attachments').insert([{
      comment_id: commentId,
      storage_path: path,
      file_name: file.name,
      file_size: file.size,
      attached_to: which,
      uploaded_by: userId,
    }]).select().single()
    if (data) onUploaded(data)
    setUploading(false)
  }

  return (
    <>
      <button onClick={() => ref.current?.click()} disabled={uploading}
        className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border disabled:opacity-60"
        style={{ color: 'var(--text-muted)', borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
        <Paperclip size={11} />{uploading ? 'Uploading…' : 'Attach'}
      </button>
      <input ref={ref} type="file" className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.docx,.doc,.dwg,.csv"
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }} />
    </>
  )
}

// ── Single comment row — defined OUTSIDE parent to prevent remount ────────────

interface RowProps {
  c: FullComment
  userId: string
  replyId: string | null
  replyText: string
  saving: boolean
  onOpenReply: (id: string) => void
  onCancelReply: () => void
  onReplyTextChange: (v: string) => void
  onSend: (c: FullComment) => void
  onClose: (id: string) => void
  onAttachmentUploaded: (commentId: string, a: CommentAttachment) => void
  onAttachmentDeleted: (commentId: string, attachmentId: string) => void
}

function CommentRow({
  c, userId, replyId, replyText, saving,
  onOpenReply, onCancelReply, onReplyTextChange, onSend, onClose,
  onAttachmentUploaded, onAttachmentDeleted,
}: RowProps) {
  const cfg = STATUS_CFG[c.status]
  const attachments = c.comment_attachments ?? []

  const supabase = createClient()

  async function deleteAttachment(id: string) {
    const att = attachments.find(a => a.id === id)
    if (!att) return
    await supabase.storage.from('documents').remove([att.storage_path])
    await supabase.from('comment_attachments').delete().eq('id', id)
    onAttachmentDeleted(c.id, id)
  }

  return (
    <div className="rounded-xl border overflow-hidden"
      style={{ borderColor: c.status === 'Open' ? 'rgba(251,146,60,0.35)' : 'var(--border)' }}>

      {/* Comment */}
      <div className="px-4 py-3" style={{ background: c.status === 'Open' ? 'rgba(251,146,60,0.05)' : 'var(--bg-surface)' }}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            {c.subject_label && (
              <p className="text-[10px] mb-0.5" style={{ color: 'var(--accent)' }}>Re: {c.subject_label}</p>
            )}
            {/* Audit stamp */}
            <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
              {c.creator_name ?? 'Client'} · {fmtDate(c.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ color: cfg.color, background: cfg.bg }}>
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
        <AttachmentList attachments={attachments} which="comment" commentId={c.id} onDelete={deleteAttachment} />
      </div>

      {/* Response */}
      {c.response && (
        <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
          {/* Response audit stamp */}
          <p className="text-[10px] font-medium mb-1.5" style={{ color: 'var(--accent)' }}>
            {c.responder_name ?? 'Team'} · {c.responded_at ? fmtDate(c.responded_at) : ''}
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{c.response}</p>
          <AttachmentList attachments={attachments} which="response" commentId={c.id} onDelete={deleteAttachment} />
          {c.client_resolved && (
            <p className="text-[10px] mt-2 flex items-center gap-1" style={{ color: '#4ade80' }}>
              <CheckCircle2 size={10} /> Client resolved
            </p>
          )}
        </div>
      )}

      {/* Reply trigger */}
      {c.status === 'Open' && replyId !== c.id && (
        <div className="px-4 py-2 border-t flex items-center gap-2"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
          <button onClick={() => onOpenReply(c.id)}
            className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--accent)' }}>
            <Reply size={11} /> Reply to client
          </button>
        </div>
      )}

      {/* Reply form */}
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
          <div className="flex items-center gap-2">
            <AttachButton commentId={c.id} which="response" userId={userId}
              onUploaded={a => onAttachmentUploaded(c.id, a)} />
            <div className="flex gap-2 ml-auto">
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
        </div>
      )}
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface Props {
  projectId: string
  initialComments: FullComment[]
  userId: string
}

export default function InternalCommentPanel({ projectId, initialComments, userId }: Props) {
  const [comments, setComments] = useState<FullComment[]>(initialComments)
  const [replyId, setReplyId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const open = comments.filter(c => c.status === 'Open')
  const rest = comments.filter(c => c.status !== 'Open')

  function updateComment(id: string, patch: Partial<FullComment>) {
    setComments(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  function onAttachmentUploaded(commentId: string, a: CommentAttachment) {
    setComments(prev => prev.map(c => c.id === commentId
      ? { ...c, comment_attachments: [...(c.comment_attachments ?? []), a] }
      : c
    ))
  }

  function onAttachmentDeleted(commentId: string, attachmentId: string) {
    setComments(prev => prev.map(c => c.id === commentId
      ? { ...c, comment_attachments: (c.comment_attachments ?? []).filter(a => a.id !== attachmentId) }
      : c
    ))
  }

  async function sendResponse(c: FullComment) {
    if (!replyText.trim()) return
    setSaving(true)
    const { data } = await supabase.from('client_comments')
      .update({
        response: replyText.trim(),
        status: 'Responded',
        responded_by: userId,
        responded_at: new Date().toISOString(),
      })
      .eq('id', c.id).select().single()
    if (data) updateComment(c.id, data)
    setReplyId(null)
    setReplyText('')
    setSaving(false)
  }

  async function closeComment(id: string) {
    const { data } = await supabase.from('client_comments').update({ status: 'Closed' }).eq('id', id).select().single()
    if (data) updateComment(id, data)
    if (replyId === id) setReplyId(null)
  }

  if (comments.length === 0) return null

  return (
    <div className="rounded-xl border overflow-hidden"
      style={{ borderColor: open.length > 0 ? 'rgba(251,146,60,0.4)' : 'var(--border)' }}>
      <div className="flex items-center justify-between px-5 py-3 border-b"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <MessageSquare size={14} style={{ color: open.length > 0 ? '#fb923c' : 'var(--accent)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Client Comments</p>
          {open.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: 'rgba(251,146,60,0.2)', color: '#fb923c' }}>
              {open.length} open
            </span>
          )}
        </div>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{comments.length} total</span>
      </div>
      <div className="p-4 space-y-3" style={{ background: 'var(--bg-elevated)' }}>
        {[...open, ...rest].map(c => (
          <CommentRow
            key={c.id}
            c={c}
            userId={userId}
            replyId={replyId}
            replyText={replyText}
            saving={saving}
            onOpenReply={id => { setReplyId(id); setReplyText('') }}
            onCancelReply={() => setReplyId(null)}
            onReplyTextChange={setReplyText}
            onSend={sendResponse}
            onClose={closeComment}
            onAttachmentUploaded={onAttachmentUploaded}
            onAttachmentDeleted={onAttachmentDeleted}
          />
        ))}
      </div>
    </div>
  )
}
