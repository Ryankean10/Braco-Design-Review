'use client'

import { useState, useRef } from 'react'
import { MessageSquare, Send, CheckCircle2, Clock, Reply, X, Paperclip, Download, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { CommentAttachment, FullComment } from '@/components/InternalCommentPanel'

export type { FullComment as ClientComment }

const STATUS_CFG = {
  Open:      { color: '#fb923c', bg: 'rgba(251,146,60,0.15)', icon: <Clock size={10} /> },
  Responded: { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)', icon: <Reply size={10} /> },
  Closed:    { color: '#4ade80', bg: 'rgba(74,222,128,0.15)', icon: <CheckCircle2 size={10} /> },
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatBytes(b: number | null) {
  if (!b) return ''
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

function AttachmentChip({ a }: { a: CommentAttachment }) {
  const supabase = createClient()
  async function download() {
    const { data } = await supabase.storage.from('documents').createSignedUrl(a.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }
  return (
    <button onClick={download}
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] hover:opacity-80"
      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
      <Paperclip size={9} style={{ color: 'var(--accent)' }} />
      <span className="max-w-[100px] truncate">{a.file_name}</span>
      {a.file_size && <span>({formatBytes(a.file_size)})</span>}
      <Download size={9} />
    </button>
  )
}

// Defined outside parent to prevent remount on keystroke
interface CardProps {
  comment: FullComment
  isClient: boolean
  canRespond: boolean
  onUpdate: (c: FullComment) => void
}

function CommentCard({ comment, isClient, canRespond, onUpdate }: CardProps) {
  const [responding, setResponding] = useState(false)
  const [responseText, setResponseText] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const attachments = comment.comment_attachments ?? []

  async function submitResponse() {
    if (!responseText.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('client_comments')
      .update({
        response: responseText.trim(),
        status: 'Responded',
        responded_by: user?.id ?? null,
        responded_at: new Date().toISOString(),
      })
      .eq('id', comment.id).select().single()
    if (data) onUpdate({ ...comment, ...data })
    setResponding(false)
    setResponseText('')
    setSaving(false)
  }

  async function closeComment() {
    const { data } = await supabase.from('client_comments').update({ status: 'Closed' }).eq('id', comment.id).select().single()
    if (data) onUpdate({ ...comment, ...data })
  }

  async function markResolved() {
    const { data } = await supabase.from('client_comments')
      .update({ client_resolved: true, client_resolved_at: new Date().toISOString(), status: 'Closed' })
      .eq('id', comment.id).select().single()
    if (data) onUpdate({ ...comment, ...data })
  }

  async function download(a: CommentAttachment) {
    const { data } = await supabase.storage.from('documents').createSignedUrl(a.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const cfg = STATUS_CFG[comment.status]

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <div className="px-4 py-3" style={{ background: 'var(--bg-surface)' }}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            {comment.subject_label && (
              <p className="text-[10px] mb-0.5" style={{ color: 'var(--accent)' }}>Re: {comment.subject_label}</p>
            )}
            {/* Audit stamp */}
            <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
              {comment.creator_name ?? 'You'} · {fmtDate(comment.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ color: cfg.color, background: cfg.bg }}>
              {cfg.icon}{comment.status}
            </span>
            {canRespond && comment.status !== 'Closed' && (
              <button onClick={closeComment} title="Close" className="p-1 hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{comment.comment}</p>
        {attachments.filter(a => a.attached_to === 'comment').length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {attachments.filter(a => a.attached_to === 'comment').map(a => (
              <AttachmentChip key={a.id} a={a} />
            ))}
          </div>
        )}
      </div>

      {comment.response && (
        <div className="px-4 py-3 border-t" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
          {/* Response audit stamp */}
          <p className="text-[10px] font-medium mb-1.5" style={{ color: 'var(--accent)' }}>
            {comment.responder_name ?? 'Project team'}{comment.responded_at ? ` · ${fmtDate(comment.responded_at)}` : ''}
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{comment.response}</p>
          {attachments.filter(a => a.attached_to === 'response').length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {attachments.filter(a => a.attached_to === 'response').map(a => (
                <AttachmentChip key={a.id} a={a} />
              ))}
            </div>
          )}
          {isClient && !comment.client_resolved && comment.status === 'Responded' && (
            <button onClick={markResolved}
              className="mt-2 flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg"
              style={{ color: '#4ade80', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)' }}>
              <CheckCircle2 size={11} /> Mark as resolved
            </button>
          )}
        </div>
      )}

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
          <textarea value={responseText} onChange={e => setResponseText(e.target.value)} rows={3}
            placeholder="Write your response…" autoFocus
            className="w-full rounded-lg border px-3 py-2 text-sm resize-none"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', borderColor: 'var(--border)' }} />
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

// ── Thread ────────────────────────────────────────────────────────────────────

interface Props {
  projectId: string
  subjectType: 'document' | 'test' | 'general'
  subjectId?: string
  subjectLabel?: string
  initialComments: FullComment[]
  isClient: boolean
  canRespond: boolean
  userId?: string
}

export default function ClientCommentThread({
  projectId, subjectType, subjectId, subjectLabel,
  initialComments, isClient, canRespond, userId,
}: Props) {
  const [comments, setComments] = useState<FullComment[]>(initialComments)
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const openCount = comments.filter(c => c.status === 'Open').length

  async function submit() {
    if (!text.trim()) return
    setSaving(true); setSubmitError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSubmitError('Not authenticated'); setSaving(false); return }

    const { data, error } = await supabase.from('client_comments').insert([{
      project_id: projectId,
      subject_type: subjectType,
      subject_id: subjectId ?? null,
      subject_label: subjectLabel ?? null,
      comment: text.trim(),
      created_by: user.id,
    }]).select().single()

    if (error) { setSubmitError(error.message); setSaving(false); return }

    // Upload pending attachments
    if (data && pendingFiles.length > 0) {
      for (const file of pendingFiles) {
        const path = `comments/${data.id}/comment/${Date.now()}-${file.name.replace(/\s+/g, '_')}`
        await supabase.storage.from('documents').upload(path, file, { upsert: false })
        await supabase.from('comment_attachments').insert([{
          comment_id: data.id, storage_path: path,
          file_name: file.name, file_size: file.size,
          attached_to: 'comment', uploaded_by: user.id,
        }])
      }
      setPendingFiles([])
    }

    if (data) {
      setComments(prev => [{ ...data, creator_name: 'You', comment_attachments: [] }, ...prev])
      setText(''); setOpen(false)
    }
    setSaving(false)
  }

  function updateComment(updated: FullComment) {
    setComments(prev => prev.map(c => c.id === updated.id ? updated : c))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <MessageSquare size={13} style={{ color: openCount > 0 ? '#fb923c' : 'var(--text-muted)' }} />
          <span>
            {comments.length === 0 ? (isClient ? 'Add a comment' : 'No comments')
              : `${comments.length} comment${comments.length !== 1 ? 's' : ''}`}
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

      {open && isClient && (
        <div className="space-y-2">
          <textarea value={text} onChange={e => setText(e.target.value)} rows={3} autoFocus
            placeholder={`Your comment on ${subjectLabel ?? 'this project'}…`}
            className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', borderColor: 'var(--border)' }} />
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pendingFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px]"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  <Paperclip size={9} style={{ color: 'var(--accent)' }} />
                  <span className="max-w-[100px] truncate">{f.name}</span>
                  <button onClick={() => setPendingFiles(p => p.filter((_, j) => j !== i))} style={{ color: '#f87171' }}>
                    <X size={9} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
              <Paperclip size={11} /> Attach
            </button>
            <input ref={fileRef} type="file" className="hidden" multiple
              accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.docx,.doc,.dwg,.csv"
              onChange={e => { if (e.target.files) setPendingFiles(p => [...p, ...Array.from(e.target.files!)]) }} />
            <div className="flex gap-2 ml-auto">
              <button onClick={() => { setOpen(false); setText(''); setPendingFiles([]) }}
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
          </div>
          {submitError && <p className="text-xs" style={{ color: '#f87171' }}>{submitError}</p>}
        </div>
      )}

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
