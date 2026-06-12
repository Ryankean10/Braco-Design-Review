'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, FileText, Download, FlaskConical, CheckCircle2, XCircle, Clock, AlertCircle, MessageSquare } from 'lucide-react'
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
}

interface Props {
  project: { id: string; name: string; client: string; location: string; stage: Stage; capacity_mw: number | null }
  stageStatuses: Record<string, string>
  documents: ClientDoc[]
  tests: TestRecord[]
  comments: ClientComment[]
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

export default function ClientProjectView({ project, stageStatuses, documents, tests, comments: initComments, userId }: Props) {
  const [comments, setComments] = useState<ClientComment[]>(initComments)
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'tests'>('overview')
  const supabase = createClient()

  async function downloadDoc(doc: ClientDoc) {
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 120)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const docComments = (docId: string) => comments.filter(c => c.subject_id === docId)
  const testComments = (testId: string) => comments.filter(c => c.subject_id === testId)
  const generalComments = comments.filter(c => c.subject_type === 'general')

  function addComment(c: ClientComment) { setComments(prev => [c, ...prev]) }
  function updateComment(c: ClientComment) { setComments(prev => prev.map(x => x.id === c.id ? c : x)) }

  const tabs = [
    { key: 'overview',   label: 'Overview' },
    { key: 'documents',  label: `Documents (${documents.length})` },
    { key: 'tests',      label: `Tests (${tests.length})` },
  ] as const

  return (
    <div className="min-h-screen p-6 space-y-6 max-w-4xl mx-auto" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="p-1.5 rounded-lg hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{project.name}</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{project.client} · {project.location}{project.capacity_mw ? ` · ${project.capacity_mw} MW` : ''}</p>
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
            style={{
              background: activeTab === t.key ? 'var(--accent)' : 'transparent',
              color: activeTab === t.key ? 'white' : 'var(--text-muted)',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border p-4 text-center" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{documents.length}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Docs for Review</p>
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

          {/* General project comments */}
          <div className="rounded-xl border p-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={14} style={{ color: 'var(--accent)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>General Comments</p>
            </div>
            <ClientCommentThread
              projectId={project.id}
              subjectType="general"
              subjectLabel={project.name}
              initialComments={generalComments}
              isClient={true}
              canRespond={false}
            />
          </div>
        </div>
      )}

      {/* Documents tab */}
      {activeTab === 'documents' && (
        <div className="space-y-3">
          {documents.length === 0 ? (
            <div className="text-center py-12 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <FileText size={24} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No documents shared for review yet</p>
            </div>
          ) : (
            documents.map(doc => (
              <div key={doc.id} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-3 px-4 py-3" style={{ background: 'var(--bg-surface)' }}>
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
                  </div>
                  <button onClick={() => downloadDoc(doc)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs"
                    style={{ color: 'var(--text-primary)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <Download size={11} /> Download
                  </button>
                </div>
                <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
                  <ClientCommentThread
                    projectId={project.id}
                    subjectType="document"
                    subjectId={doc.id}
                    subjectLabel={`${doc.doc_no} – ${doc.title}`}
                    initialComments={docComments(doc.id)}
                    isClient={true}
                    canRespond={false}
                  />
                </div>
              </div>
            ))
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
                      {test.result_summary && (
                        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{test.result_summary}</p>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0"
                      style={{ color: cfg.color, background: `${cfg.color}20` }}>
                      {cfg.icon}{test.status}
                    </span>
                  </div>
                  <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
                    <ClientCommentThread
                      projectId={project.id}
                      subjectType="test"
                      subjectId={test.id}
                      subjectLabel={`${test.test_ref ? test.test_ref + ' – ' : ''}${test.title}`}
                      initialComments={testComments(test.id)}
                      isClient={true}
                      canRespond={false}
                    />
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
