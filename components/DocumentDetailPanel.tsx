'use client'

import { useState, useEffect } from 'react'
import { Download, MessageSquare, Eye, Clock, CheckCircle2, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const STATUS_CFG: Record<string, { color: string; bg: string; border: string }> = {
  'WIP':                        { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',  border: 'rgba(148,163,184,0.3)' },
  'Internal Review':            { color: '#fb923c', bg: 'rgba(251,146,60,0.1)',   border: 'rgba(251,146,60,0.3)' },
  'Ready for Client Review':    { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',   border: 'rgba(96,165,250,0.3)' },
  'Approved for Construction':  { color: '#34d399', bg: 'rgba(52,211,153,0.1)',   border: 'rgba(52,211,153,0.3)' },
}

interface Revision {
  id: string
  doc_no: string
  title: string
  rev: string
  storage_path: string | null
  file_name: string | null
  file_size: number | null
  doc_status: string
  uploaded_at: string
}

interface HistoryEntry {
  id: string
  from_status: string | null
  to_status: string
  changed_at: string
  note: string | null
  triggered_by: string
  actor_name: string
}

interface ViewEntry {
  id: string
  viewed_at: string
  viewer_name: string
}

interface Comment {
  id: string
  parent_id: string | null
  comment: string
  author_name: string
  author_role: string
  created_at: string
  status: string
  resolved_at: string | null
  resolved_by_name: string | null
  replies?: Comment[]
}

interface Props {
  documentId: string
  allRevisions: Revision[]
  canEdit: boolean
  userRole: string
  onDownload: (rev: Revision) => void
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmt(ts: string) {
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

type Tab = 'history' | 'views' | 'comments'

export default function DocumentDetailPanel({ documentId, allRevisions, canEdit, userRole, onDownload }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('comments')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [views, setViews] = useState<ViewEntry[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [expandedRevs, setExpandedRevs] = useState(false)

  useEffect(() => {
    loadAll()
  }, [documentId])

  async function loadAll() {
    setLoading(true)
    const supabase = createClient()

    const [histRes, viewRes, commentRes] = await Promise.all([
      supabase
        .from('document_status_history')
        .select('id, from_status, to_status, changed_at, note, triggered_by, changed_by')
        .eq('document_id', documentId)
        .order('changed_at', { ascending: true }),
      supabase
        .from('document_views')
        .select('id, viewed_at, viewed_by')
        .eq('document_id', documentId)
        .order('viewed_at', { ascending: false })
        .limit(50),
      supabase
        .from('document_comments')
        .select('id, parent_id, comment, author_id, author_role, created_at, status, resolved_at, resolved_by')
        .eq('document_id', documentId)
        .order('created_at', { ascending: true }),
    ])

    // Collect all user IDs to resolve names
    const userIds = new Set<string>()
    for (const h of histRes.data ?? []) if (h.changed_by) userIds.add(h.changed_by)
    for (const v of viewRes.data ?? []) if (v.viewed_by) userIds.add(v.viewed_by)
    for (const c of commentRes.data ?? []) {
      if (c.author_id) userIds.add(c.author_id)
      if (c.resolved_by) userIds.add(c.resolved_by)
    }

    let profiles: Record<string, string> = {}
    if (userIds.size) {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', [...userIds])
      profiles = Object.fromEntries((data ?? []).map((p: any) => [p.id, p.full_name ?? p.email ?? p.id]))
    }

    const name = (id: string | null) => id ? (profiles[id] ?? 'Unknown') : 'System'

    setHistory((histRes.data ?? []).map((h: any) => ({
      id: h.id,
      from_status: h.from_status,
      to_status: h.to_status,
      changed_at: h.changed_at,
      note: h.note,
      triggered_by: h.triggered_by,
      actor_name: name(h.changed_by),
    })))

    setViews((viewRes.data ?? []).map((v: any) => ({
      id: v.id,
      viewed_at: v.viewed_at,
      viewer_name: name(v.viewed_by),
    })))

    // Build threaded comments
    const flat: Comment[] = (commentRes.data ?? []).map((c: any) => ({
      id: c.id,
      parent_id: c.parent_id,
      comment: c.comment,
      author_name: name(c.author_id),
      author_role: c.author_role,
      created_at: c.created_at,
      status: c.status,
      resolved_at: c.resolved_at,
      resolved_by_name: c.resolved_by ? name(c.resolved_by) : null,
      replies: [],
    }))
    const byId: Record<string, Comment> = Object.fromEntries(flat.map(c => [c.id, c]))
    const roots: Comment[] = []
    for (const c of flat) {
      if (c.parent_id && byId[c.parent_id]) {
        byId[c.parent_id].replies!.push(c)
      } else {
        roots.push(c)
      }
    }
    setComments(roots)
    setLoading(false)
  }

  async function submitComment(parentId?: string) {
    const text = parentId ? replyText : newComment
    if (!text.trim()) return
    setSubmitting(true)
    const res = await fetch(`/api/documents/${documentId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: text.trim(), parentId }),
    })
    if (res.ok) {
      setNewComment('')
      setReplyText('')
      setReplyingTo(null)
      await loadAll()
    }
    setSubmitting(false)
  }

  async function resolveComment(commentId: string, action: 'resolve' | 'reopen') {
    await fetch(`/api/document-comments/${commentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    await loadAll()
  }

  const openCount = comments.reduce((n, c) => n + (c.status === 'open' ? 1 : 0) + (c.replies?.filter(r => r.status === 'open').length ?? 0), 0)

  const tabStyle = (t: Tab) => ({
    color: activeTab === t ? 'var(--accent)' : 'var(--text-muted)',
    borderBottom: activeTab === t ? '2px solid var(--accent)' : '2px solid transparent',
    background: 'transparent',
  })

  return (
    <div className="border-t px-5 py-4 space-y-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>

      {/* Revisions accordion */}
      <div>
        <button
          onClick={() => setExpandedRevs(v => !v)}
          className="flex items-center gap-2 text-xs font-semibold mb-2"
          style={{ color: 'var(--text-primary)' }}>
          {expandedRevs ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          All revisions ({allRevisions.length})
        </button>
        {expandedRevs && (
          <div className="rounded-lg border divide-y overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            {allRevisions.map((rev, i) => {
              const cfg = STATUS_CFG[rev.doc_status] ?? STATUS_CFG['WIP']
              return (
                <div key={rev.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-xs font-mono font-semibold w-12 flex-shrink-0" style={{ color: i === 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {rev.rev}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                    {rev.doc_status}
                  </span>
                  <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-muted)' }}>
                    {new Date(rev.uploaded_at).toLocaleDateString('en-GB')} · {formatBytes(rev.file_size)}
                  </span>
                  {rev.storage_path && (
                    <button onClick={() => onDownload(rev)} className="p-1 hover:opacity-70" style={{ color: 'var(--text-muted)' }} title="Download this revision">
                      <Download size={13} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b" style={{ borderColor: 'var(--border)' }}>
        {([
          { key: 'comments', label: `Comments${openCount > 0 ? ` (${openCount} open)` : ''}`, icon: <MessageSquare size={11} /> },
          { key: 'history',  label: `Status history (${history.length})`, icon: <Clock size={11} /> },
          { key: 'views',    label: `View log (${views.length})`, icon: <Eye size={11} /> },
        ] as { key: Tab; label: string; icon: React.ReactNode }[]).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors"
            style={tabStyle(t.key)}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : (
        <>
          {/* ── Comments tab ── */}
          {activeTab === 'comments' && (
            <div className="space-y-3">
              {comments.length === 0 && (
                <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>No comments yet.</p>
              )}
              {comments.map(c => (
                <CommentThread key={c.id} comment={c} canEdit={canEdit}
                  onResolve={resolveComment}
                  onReply={id => { setReplyingTo(id); setReplyText('') }}
                  replyingTo={replyingTo}
                  replyText={replyText}
                  onReplyTextChange={setReplyText}
                  onSubmitReply={() => submitComment(c.id)}
                  submitting={submitting}
                />
              ))}
              {/* New top-level comment */}
              <div className="pt-2 space-y-2">
                <textarea
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Add a comment…"
                  rows={2}
                  className="w-full rounded-lg px-3 py-2 text-xs resize-none outline-none"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
                <button
                  onClick={() => submitComment()}
                  disabled={submitting || !newComment.trim()}
                  className="text-xs px-4 py-1.5 rounded-lg font-medium text-white disabled:opacity-50"
                  style={{ background: 'var(--accent)' }}>
                  {submitting ? 'Posting…' : 'Post comment'}
                </button>
              </div>
            </div>
          )}

          {/* ── Status history tab ── */}
          {activeTab === 'history' && (
            <div className="space-y-2">
              {history.length === 0 && (
                <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>No status changes recorded.</p>
              )}
              {history.map(h => {
                const toCfg = STATUS_CFG[h.to_status] ?? STATUS_CFG['WIP']
                return (
                  <div key={h.id} className="flex items-start gap-3 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: toCfg.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {h.from_status && (
                          <span style={{ color: 'var(--text-muted)' }}>{h.from_status} →</span>
                        )}
                        <span className="font-semibold" style={{ color: toCfg.color }}>{h.to_status}</span>
                        {h.triggered_by === 'client_comment' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c' }}>auto-revert</span>
                        )}
                      </div>
                      <p style={{ color: 'var(--text-muted)' }}>
                        {h.actor_name} · {fmt(h.changed_at)}
                      </p>
                      {h.note && <p className="mt-0.5 italic" style={{ color: 'var(--text-muted)' }}>{h.note}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── View log tab ── */}
          {activeTab === 'views' && (
            <div className="space-y-1.5">
              {views.length === 0 && (
                <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>No views recorded yet.</p>
              )}
              {views.map(v => (
                <div key={v.id} className="flex items-center gap-3 text-xs">
                  <Eye size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-primary)' }}>{v.viewer_name}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{fmt(v.viewed_at)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function CommentThread({ comment, canEdit, onResolve, onReply, replyingTo, replyText, onReplyTextChange, onSubmitReply, submitting }: {
  comment: Comment
  canEdit: boolean
  onResolve: (id: string, action: 'resolve' | 'reopen') => void
  onReply: (id: string) => void
  replyingTo: string | null
  replyText: string
  onReplyTextChange: (v: string) => void
  onSubmitReply: () => void
  submitting: boolean
}) {
  const isResolved = comment.status === 'resolved'
  const roleColor: Record<string, string> = {
    admin: '#f87171', engineer: '#a78bfa', project_manager: '#60a5fa',
    client: '#34d399', operative: '#94a3b8',
  }

  return (
    <div className="rounded-lg border overflow-hidden" style={{
      borderColor: isResolved ? 'rgba(52,211,153,0.2)' : 'var(--border)',
      background: isResolved ? 'rgba(52,211,153,0.04)' : 'var(--bg-surface)',
    }}>
      {/* Main comment */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{comment.author_name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-elevated)', color: roleColor[comment.author_role] ?? 'var(--text-muted)' }}>
              {comment.author_role}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{fmt(comment.created_at)}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isResolved ? (
              <>
                <CheckCircle2 size={12} style={{ color: '#34d399' }} />
                <span className="text-[10px]" style={{ color: '#34d399' }}>Resolved</span>
                {canEdit && (
                  <button onClick={() => onResolve(comment.id, 'reopen')}
                    className="text-[10px] px-2 py-0.5 rounded border hover:opacity-80"
                    style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                    Reopen
                  </button>
                )}
              </>
            ) : (
              <>
                {canEdit && (
                  <button onClick={() => onResolve(comment.id, 'resolve')}
                    className="text-[10px] px-2 py-0.5 rounded border hover:opacity-80"
                    style={{ color: '#34d399', borderColor: 'rgba(52,211,153,0.3)' }}>
                    Resolve
                  </button>
                )}
                <button onClick={() => onReply(comment.id)}
                  className="text-[10px] px-2 py-0.5 rounded border hover:opacity-80"
                  style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                  Reply
                </button>
              </>
            )}
          </div>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: isResolved ? 'var(--text-muted)' : 'var(--text-primary)' }}>
          {comment.comment}
        </p>
        {isResolved && comment.resolved_by_name && (
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
            Resolved by {comment.resolved_by_name} · {comment.resolved_at ? fmt(comment.resolved_at) : ''}
          </p>
        )}
      </div>

      {/* Replies */}
      {(comment.replies?.length ?? 0) > 0 && (
        <div className="border-t divide-y" style={{ borderColor: 'var(--border)' }}>
          {comment.replies!.map(reply => (
            <div key={reply.id} className="px-4 py-2.5 pl-8">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{reply.author_name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-elevated)', color: roleColor[reply.author_role] ?? 'var(--text-muted)' }}>
                  {reply.author_role}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{fmt(reply.created_at)}</span>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-primary)' }}>{reply.comment}</p>
            </div>
          ))}
        </div>
      )}

      {/* Reply form */}
      {replyingTo === comment.id && (
        <div className="border-t px-4 py-3 space-y-2" style={{ borderColor: 'var(--border)' }}>
          <textarea
            value={replyText}
            onChange={e => onReplyTextChange(e.target.value)}
            placeholder="Write a reply…"
            rows={2}
            autoFocus
            className="w-full rounded-lg px-3 py-2 text-xs resize-none outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
          <button
            onClick={onSubmitReply}
            disabled={submitting || !replyText.trim()}
            className="text-xs px-3 py-1.5 rounded-lg font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--accent)' }}>
            {submitting ? '…' : 'Reply'}
          </button>
        </div>
      )}
    </div>
  )
}
