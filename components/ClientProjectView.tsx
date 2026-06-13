'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, FileText, Download, FlaskConical, CheckCircle2, XCircle, Clock, AlertCircle, MessageSquare, Bell, ChevronDown, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ClientCommentThread, { type ClientComment } from '@/components/ClientCommentThread'
import type { TestRecord, TestStatus } from '@/lib/types'

type Stage = 'Feasibility' | 'Design' | 'Procure' | 'Build & Install' | 'Test & Commission' | 'Energise & Handover'

const STAGES: Stage[] = ['Feasibility', 'Design', 'Procure', 'Build & Install', 'Test & Commission', 'Energise & Handover']

const TEST_STATUS_CFG: Record<TestStatus, { color: string; icon: React.ReactNode }> = {
  'Planned':          { color: '#94a3b8', icon: <Clock size={11} /> },
  'In Progress':      { color: '#60a5fa', icon: <Clock size={11} /> },
  'Pass':             { color: '#4ade80', icon: <CheckCircle2 size={11} /> },
  'Conditional Pass': { color: '#fb923c', icon: <AlertCircle size={11} /> },
  'Fail':             { color: '#f87171', icon: <XCircle size={11} /> },
  'Awaiting Review':  { color: '#c084fc', icon: <Clock size={11} /> },
  'Cancelled':        { color: '#475569', icon: <Clock size={11} /> },
}

interface ClientDoc {
  id: string
  doc_no: string
  title: string
  rev: string
  type: string
  storage_path: string
  file_name: string
  client_review_note: string | null
  open_comment_count: number
}

interface Notification {
  id: string
  document_id: string | null
  title: string
  body: string | null
  created_at: string
  read_at: string | null
}

interface Props {
  project: { id: string; name: string; client: string; location: string; stage: Stage; capacity_mw: number | null }
  stageStatuses: Record<string, string>
  documents: ClientDoc[]
  tests: TestRecord[]
  comments: ClientComment[]
  notifications: Notification[]
  userId: string
}

const STAGE_COLORS: Record<string, string> = {
  'Feasibility':         '#94a3b8',
  'Design':              '#60a5fa',
  'Procure':             '#c084fc',
  'Build & Install':     '#fb923c',
  'Test & Commission':   '#facc15',
  'Energise & Handover': '#4ade80',
}

export default function ClientProjectView({ project, stageStatuses, documents, tests, comments: initComments, notifications: initNotifications, userId }: Props) {
  const [comments, setComments] = useState<ClientComment[]>(initComments)
  const [notifications, setNotifications] = useState<Notification[]>(initNotifications)
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'tests'>('overview')
  const [showNotifications, setShowNotifications] = useState(false)
  const supabase = createClient()

  // Split docs: needs review (open comments or no comments yet) vs all-comments-resolved
  const awaitingReview = documents.filter(d => d.open_comment_count > 0 || (d.open_comment_count === 0 && !comments.some(c => c.subject_id === d.id && c.subject_type === 'document')))
  const commentsResolved = documents.filter(d => d.open_comment_count === 0 && comments.some(c => c.subject_id === d.id && c.subject_type === 'document'))

  const unreadCount = notifications.filter(n => !n.read_at).length

  async function markNotificationsRead() {
    if (unreadCount === 0) return
    await fetch('/api/notifications', { method: 'PATCH' })
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
  }

  async function downloadDoc(doc: ClientDoc) {
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 120)
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
      fetch(`/api/documents/${doc.id}/view`, { method: 'POST' }).catch(() => {})
    }
  }

  function addComment(c: ClientComment) { setComments(prev => [c, ...prev]) }
  function updateComment(c: ClientComment) { setComments(prev => prev.map(x => x.id === c.id ? c : x)) }

  const docComments = (docId: string) => comments.filter(c => c.subject_id === docId)
  const testComments = (testId: string) => comments.filter(c => c.subject_id === testId)
  const generalComments = comments.filter(c => c.subject_type === 'general')

  const tabs = [
    { key: 'overview',  label: 'Overview' },
    { key: 'documents', label: `For Review (${documents.length})` },
    { key: 'tests',     label: `Tests (${tests.length})` },
  ] as const

  return (
    <div className="min-h-screen p-6 space-y-6 max-w-4xl mx-auto" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="p-1.5 rounded-lg hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{project.name}</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{project.client} · {project.location}{project.capacity_mw ? ` · ${project.capacity_mw} MW` : ''}</p>
          </div>
        </div>

        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => { setShowNotifications(v => !v); if (!showNotifications) markNotificationsRead() }}
            className="relative p-2 rounded-lg hover:opacity-80"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
                style={{ background: '#f87171' }}>{unreadCount}</span>
            )}
          </button>
          {showNotifications && (
            <div className="absolute right-0 top-10 w-80 rounded-xl border shadow-xl z-50 overflow-hidden"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Notifications</p>
                <button onClick={() => setShowNotifications(false)} className="text-xs" style={{ color: 'var(--text-muted)' }}>✕</button>
              </div>
              {notifications.length === 0 ? (
                <p className="px-4 py-6 text-xs text-center" style={{ color: 'var(--text-muted)' }}>No notifications</p>
              ) : (
                <div className="divide-y max-h-72 overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
                  {notifications.map(n => (
                    <div key={n.id} className="px-4 py-3" style={{ background: n.read_at ? 'transparent' : 'rgba(108,114,245,0.05)' }}>
                      <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{n.title}</p>
                      {n.body && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{n.body}</p>}
                      <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                        {new Date(n.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stage progress */}
      <div className="rounded-xl border p-5" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Project Stages</p>
        <div className="flex flex-wrap gap-2">
          {STAGES.map(s => {
            const status = stageStatuses[s] ?? 'Not Started'
            const isComplete = status === 'Complete'
            const isActive   = status === 'In Progress' || status === 'On Hold'
            const col = STAGE_COLORS[s] ?? '#94a3b8'
            return (
              <div key={s} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{
                  background:  isComplete ? 'rgba(74,222,128,0.15)' : isActive ? `${col}20` : 'var(--bg-elevated)',
                  color:       isComplete ? '#4ade80'               : isActive ? col        : 'var(--text-muted)',
                  border:      `1px solid ${isComplete ? 'rgba(74,222,128,0.4)' : isActive ? `${col}50` : 'var(--border)'}`,
                  opacity:     isComplete || isActive ? 1 : 0.45,
                }}>
                {isComplete && <CheckCircle2 size={11} className="flex-shrink-0" />}
                {isActive   && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: col }} />}
                {s}
              </div>
            )
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
            style={{ background: activeTab === t.key ? 'var(--accent)' : 'transparent', color: activeTab === t.key ? 'white' : 'var(--text-muted)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border p-4 text-center" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <p className="text-2xl font-bold" style={{ color: awaitingReview.length > 0 ? '#fb923c' : 'var(--accent)' }}>{awaitingReview.length}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Awaiting Your Review</p>
            </div>
            <div className="rounded-xl border p-4 text-center" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <p className="text-2xl font-bold" style={{ color: '#4ade80' }}>{tests.filter(t => t.status === 'Pass').length}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Tests Passed</p>
            </div>
            <div className="rounded-xl border p-4 text-center" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <p className="text-2xl font-bold" style={{ color: '#fb923c' }}>
                {comments.filter(c => c.status === 'Open').length}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Open Comments</p>
            </div>
          </div>
          <div className="rounded-xl border p-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={14} style={{ color: 'var(--accent)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>General Comments</p>
            </div>
            <ClientCommentThread
              projectId={project.id} subjectType="general" subjectLabel={project.name}
              initialComments={generalComments} isClient={true} canRespond={false} />
          </div>
        </div>
      )}

      {/* Documents tab */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          {documents.length === 0 ? (
            <div className="text-center py-12 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <FileText size={24} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No documents sent for review yet</p>
            </div>
          ) : (
            <>
              {/* Awaiting review section */}
              {awaitingReview.length > 0 && (
                <DocSection
                  title="Awaiting your review"
                  count={awaitingReview.length}
                  accentColor="#fb923c"
                  defaultOpen={true}
                  docs={awaitingReview}
                  project={project}
                  comments={comments}
                  onDownload={downloadDoc}
                  onAddComment={addComment}
                  onUpdateComment={updateComment}
                />
              )}

              {/* Comments resolved — team will confirm AFC */}
              {commentsResolved.length > 0 && (
                <DocSection
                  title="Comments addressed — awaiting team sign-off"
                  count={commentsResolved.length}
                  accentColor="#34d399"
                  defaultOpen={false}
                  docs={commentsResolved}
                  project={project}
                  comments={comments}
                  onDownload={downloadDoc}
                  onAddComment={addComment}
                  onUpdateComment={updateComment}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Tests tab */}
      {activeTab === 'tests' && (
        <div className="space-y-2">
          {tests.length === 0 ? (
            <div className="text-center py-12 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <FlaskConical size={24} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No test results available yet</p>
            </div>
          ) : (
            tests.map(test => {
              const cfg = TEST_STATUS_CFG[test.status]
              return (
                <div key={test.id} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-3 px-4 py-3" style={{ background: 'var(--bg-surface)' }}>
                    <FlaskConical size={14} style={{ color: 'var(--text-muted)' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {test.test_ref && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(108,114,245,0.1)', color: 'var(--accent)' }}>{test.test_ref}</span>}
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{test.title}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        <span>{test.category} · {test.test_type}</span>
                        {test.actual_date && <span>Completed {new Date(test.actual_date).toLocaleDateString('en-GB')}</span>}
                        {test.location && <span>@ {test.location}</span>}
                        {test.witnessed_by && <span>Witnessed: {test.witnessed_by}</span>}
                      </div>
                      {test.result_summary && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{test.result_summary}</p>}
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0"
                      style={{ color: cfg.color, background: `${cfg.color}20` }}>
                      {cfg.icon}{test.status}
                    </span>
                  </div>
                  <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
                    <ClientCommentThread
                      projectId={project.id} subjectType="test" subjectId={test.id}
                      subjectLabel={`${test.test_ref ? test.test_ref + ' – ' : ''}${test.title}`}
                      initialComments={testComments(test.id)} isClient={true} canRespond={false} />
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

function DocSection({ title, count, accentColor, defaultOpen, docs, project, comments, onDownload, onAddComment, onUpdateComment }: {
  title: string
  count: number
  accentColor: string
  defaultOpen: boolean
  docs: ClientDoc[]
  project: { id: string }
  comments: ClientComment[]
  onDownload: (doc: ClientDoc) => void
  onAddComment: (c: ClientComment) => void
  onUpdateComment: (c: ClientComment) => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  const docComments = (docId: string) => comments.filter(c => c.subject_id === docId)

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: `${accentColor}40` }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3"
        style={{ background: `${accentColor}10` }}>
        <div className="flex items-center gap-2">
          {open ? <ChevronDown size={14} style={{ color: accentColor }} /> : <ChevronRight size={14} style={{ color: accentColor }} />}
          <span className="text-sm font-semibold" style={{ color: accentColor }}>{title}</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${accentColor}20`, color: accentColor }}>{count}</span>
        </div>
      </button>
      {open && (
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {docs.map(doc => (
            <div key={doc.id} className="overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
              <div className="flex items-center gap-3 px-4 py-3">
                <FileText size={16} style={{ color: 'var(--accent)' }} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{doc.doc_no}</span>
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{doc.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(108,114,245,0.1)', color: 'var(--accent)' }}>Rev {doc.rev}</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{doc.type}</span>
                  </div>
                  {doc.client_review_note && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{doc.client_review_note}</p>
                  )}
                  {doc.open_comment_count > 0 && (
                    <p className="text-[10px] mt-0.5" style={{ color: '#fb923c' }}>
                      {doc.open_comment_count} open comment{doc.open_comment_count !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <button onClick={() => onDownload(doc)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs flex-shrink-0"
                  style={{ color: 'var(--text-primary)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <Download size={11} /> Download
                </button>
              </div>
              <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
                <ClientCommentThread
                  projectId={project.id} subjectType="document" subjectId={doc.id}
                  subjectLabel={`${doc.doc_no} – ${doc.title}`}
                  initialComments={docComments(doc.id)} isClient={true} canRespond={false} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
