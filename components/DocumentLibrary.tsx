'use client'

import { useState, useRef } from 'react'
import { Upload, Download, FileText, ChevronUp, ChevronDown, FileSpreadsheet, Paperclip, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import DocumentImport from '@/components/DocumentImport'
import DocumentBulkAttach from '@/components/DocumentBulkAttach'
import DocumentDetailPanel from '@/components/DocumentDetailPanel'
import type { Document, DocType, Stage } from '@/lib/types'

const DOC_TYPES: DocType[] = ['Drawing', 'Specification', 'Report', 'Schedule', 'Certificate', 'Other']
const STAGES: Stage[] = ['Feasibility', 'Design', 'Procure', 'Build & Install', 'Test & Commission', 'Energise & Handover']

const STATUSES = ['WIP', 'Internal Review', 'Ready for Client Review', 'Approved for Construction'] as const
type DocStatus = typeof STATUSES[number]

const STATUS_CFG: Record<DocStatus, { color: string; bg: string; border: string }> = {
  'WIP':                        { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',  border: 'rgba(148,163,184,0.3)' },
  'Internal Review':            { color: '#fb923c', bg: 'rgba(251,146,60,0.1)',   border: 'rgba(251,146,60,0.3)' },
  'Ready for Client Review':    { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',   border: 'rgba(96,165,250,0.3)' },
  'Approved for Construction':  { color: '#34d399', bg: 'rgba(52,211,153,0.1)',   border: 'rgba(52,211,153,0.3)' },
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface Props {
  projectId: string
  projectStage: Stage
  initialDocuments: Document[]
  userRole: string
}

export default function DocumentLibrary({ projectId, projectStage, initialDocuments, userRole }: Props) {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments)
  const [showUpload, setShowUpload] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showBulkAttach, setShowBulkAttach] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [expandedDetail, setExpandedDetail] = useState<Set<string>>(new Set())
  const [attachingId, setAttachingId] = useState<string | null>(null)
  const attachInputRef = useRef<HTMLInputElement | null>(null)
  const [attachingDoc, setAttachingDoc] = useState<Document | null>(null)
  const [statusChanging, setStatusChanging] = useState<string | null>(null)
  const [statusNote, setStatusNote] = useState('')
  const [statusError, setStatusError] = useState<Record<string, string>>({})

  // Upload form state
  const [file, setFile] = useState<File | null>(null)
  const [docNo, setDocNo] = useState('')
  const [title, setTitle] = useState('')
  const [rev, setRev] = useState('P01')
  const [docType, setDocType] = useState<DocType>('Drawing')
  const [stage, setStage] = useState<Stage>(projectStage)
  const [supersedes, setSupersedes] = useState('')

  function resetForm() {
    setFile(null); setDocNo(''); setTitle(''); setRev('P01')
    setDocType('Drawing'); setStage(projectStage); setSupersedes('')
    setUploadError('')
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setUploading(true); setUploadError('')

    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const storagePath = `${projectId}/${Date.now()}-${docNo.replace(/\s+/g, '_')}-${rev}.${ext}`

    const { error: storageErr } = await supabase.storage
      .from('documents').upload(storagePath, file, { upsert: false })
    if (storageErr) { setUploadError(storageErr.message); setUploading(false); return }

    const payload: Partial<Document> = {
      project_id: projectId,
      doc_no: docNo.trim(), title: title.trim(), rev: rev.trim(),
      type: docType, stage, storage_path: storagePath,
      file_name: file.name, file_size: file.size, mime_type: file.type,
      supersedes: supersedes || null,
    }

    const { data, error: dbErr } = await supabase.from('documents').insert(payload).select().single()
    if (dbErr) { setUploadError(dbErr.message); setUploading(false); return }

    setDocuments(prev => [data, ...prev])
    setShowUpload(false); resetForm(); setUploading(false)
  }

  async function handleQuickAttach(doc: Document, file: File) {
    setAttachingId(doc.id)
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const storagePath = `${projectId}/${Date.now()}-${doc.doc_no.replace(/\s+/g, '_')}-${doc.rev}.${ext}`

    const { error: storageErr } = await supabase.storage.from('documents').upload(storagePath, file, { upsert: false })
    if (!storageErr) {
      await supabase.from('documents').update({
        storage_path: storagePath, file_name: file.name,
        file_size: file.size, mime_type: file.type,
      }).eq('id', doc.id)
      setDocuments(prev => prev.map(d => d.id === doc.id
        ? { ...d, storage_path: storagePath, file_name: file.name, file_size: file.size, mime_type: file.type } : d))
    }
    setAttachingId(null); setAttachingDoc(null)
  }

  async function handleDownload(doc: Document) {
    const supabase = createClient()
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 60)
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
      // Log the view (fire-and-forget)
      fetch(`/api/documents/${doc.id}/view`, { method: 'POST' }).catch(() => {})
    }
  }

  async function handleStatusChange(docId: string, newStatus: DocStatus) {
    setStatusChanging(docId)
    setStatusError(prev => ({ ...prev, [docId]: '' }))
    const res = await fetch(`/api/documents/${docId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, note: statusNote.trim() || undefined }),
    })
    const data = await res.json()
    if (!res.ok) {
      setStatusError(prev => ({ ...prev, [docId]: data.error }))
    } else {
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, doc_status: newStatus } as any : d))
      setStatusNote('')
    }
    setStatusChanging(null)
  }

  async function toggleClientReview(doc: Document) {
    const supabase = createClient()
    const next = !(doc as any).for_client_review
    await supabase.from('documents').update({ for_client_review: next }).eq('id', doc.id)
    setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, for_client_review: next } as any : d))
  }

  const canEdit = ['admin', 'engineer'].includes(userRole)

  // Group by doc_no (latest revision first per group)
  const byDocNo = documents.reduce<Record<string, Document[]>>((acc, doc) => {
    if (!acc[doc.doc_no]) acc[doc.doc_no] = []
    acc[doc.doc_no].push(doc)
    return acc
  }, {})
  const latestDocs = Object.values(byDocNo).map(revs => revs[0])

  const fieldStyle = {
    background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)',
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {latestDocs.length} document{latestDocs.length !== 1 ? 's' : ''}
        </p>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={() => { setShowBulkAttach(!showBulkAttach); setShowImport(false); setShowUpload(false) }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-opacity hover:opacity-80"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
              <Paperclip size={14} /> Attach files
            </button>
            <button onClick={() => { setShowImport(!showImport); setShowBulkAttach(false); setShowUpload(false) }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-opacity hover:opacity-80"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
              <FileSpreadsheet size={14} /> Import CSV
            </button>
            <button onClick={() => { setShowUpload(!showUpload); setShowImport(false); resetForm() }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity"
              style={{ background: 'var(--accent)' }}>
              <Upload size={14} /> Upload document
            </button>
          </div>
        )}
      </div>

      {/* Bulk attach */}
      {showBulkAttach && (
        <DocumentBulkAttach projectId={projectId} documents={documents}
          onDone={() => { setShowBulkAttach(false); window.location.reload() }}
          onClose={() => setShowBulkAttach(false)} />
      )}

      {/* CSV Import */}
      {showImport && (
        <DocumentImport projectId={projectId}
          onImported={() => { setShowImport(false); window.location.reload() }}
          onClose={() => setShowImport(false)} />
      )}

      {/* Upload form */}
      {showUpload && (
        <form onSubmit={handleUpload} className="rounded-xl border p-5 space-y-4"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Upload document</h3>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>File *</label>
            <input type="file" required accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.xlsx,.docx"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm rounded-lg px-3 py-2 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:text-white"
              style={fieldStyle} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Doc number *</label>
              <input value={docNo} onChange={e => setDocNo(e.target.value)} required
                className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={fieldStyle}
                placeholder="e.g. BRA-EL-001" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} required
                className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={fieldStyle}
                placeholder="e.g. Single Line Diagram" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Revision *</label>
              <input value={rev} onChange={e => setRev(e.target.value)} required
                className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={fieldStyle} placeholder="e.g. P01" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Type *</label>
              <select value={docType} onChange={e => setDocType(e.target.value as DocType)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={fieldStyle}>
                {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Stage *</label>
              <select value={stage} onChange={e => setStage(e.target.value as Stage)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={fieldStyle}>
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {documents.length > 0 && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Supersedes (select if uploading a new revision)
              </label>
              <select value={supersedes} onChange={e => setSupersedes(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={fieldStyle}>
                <option value="">— none —</option>
                {documents.map(d => (
                  <option key={d.id} value={d.id}>{d.doc_no} Rev {d.rev} — {d.title}</option>
                ))}
              </select>
            </div>
          )}
          {uploadError && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ background: '#3f1212', color: '#f87171' }}>{uploadError}</p>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => { setShowUpload(false); resetForm() }}
              className="text-sm px-4 py-2 rounded-lg border"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>Cancel</button>
            <button type="submit" disabled={uploading}
              className="text-sm px-4 py-2 rounded-lg font-medium text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}>{uploading ? 'Uploading…' : 'Upload'}</button>
          </div>
        </form>
      )}

      {/* Status summary bar */}
      {latestDocs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {STATUSES.map(s => {
            const count = latestDocs.filter(d => (((d as any).doc_status) ?? 'WIP') === s).length
            const cfg = STATUS_CFG[s]
            return (
              <span key={s} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                {s} <span className="font-bold">{count}</span>
              </span>
            )
          })}
        </div>
      )}

      {/* Status-grouped document sections */}
      {latestDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-xl border"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <FileText size={36} style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No documents uploaded yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {STATUSES.map(status => {
            const sectionDocs = latestDocs.filter(d => (((d as any).doc_status) ?? 'WIP') === status)
            if (sectionDocs.length === 0) return null
            const cfg = STATUS_CFG[status]
            return (
              <StatusSection
                key={status}
                status={status}
                cfg={cfg}
                docs={sectionDocs}
                byDocNo={byDocNo}
                expandedDetail={expandedDetail}
                setExpandedDetail={setExpandedDetail}
                canEdit={canEdit}
                statusChanging={statusChanging}
                statusError={statusError}
                attachingId={attachingId}
                attachingDoc={attachingDoc}
                attachInputRef={attachInputRef}
                userRole={userRole}
                onStatusChange={handleStatusChange}
                onDownload={handleDownload}
                onToggleClientReview={toggleClientReview}
                onAttachDoc={(doc) => { setAttachingDoc(doc); setTimeout(() => attachInputRef.current?.click(), 50) }}
                onAttachFile={(f) => { if (f && attachingDoc) handleQuickAttach(attachingDoc, f) }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

interface SectionProps {
  status: DocStatus
  cfg: { color: string; bg: string; border: string }
  docs: Document[]
  byDocNo: Record<string, Document[]>
  expandedDetail: Set<string>
  setExpandedDetail: React.Dispatch<React.SetStateAction<Set<string>>>
  canEdit: boolean
  statusChanging: string | null
  statusError: Record<string, string>
  attachingId: string | null
  attachingDoc: Document | null
  attachInputRef: React.MutableRefObject<HTMLInputElement | null>
  userRole: string
  onStatusChange: (id: string, s: DocStatus) => void
  onDownload: (doc: Document) => void
  onToggleClientReview: (doc: Document) => void
  onAttachDoc: (doc: Document) => void
  onAttachFile: (f: File | undefined) => void
}

function StatusSection({ status, cfg, docs, byDocNo, expandedDetail, setExpandedDetail, canEdit, statusChanging, statusError, attachingId, attachingDoc, attachInputRef, userRole, onStatusChange, onDownload, onToggleClientReview, onAttachDoc, onAttachFile }: SectionProps) {
  const [open, setOpen] = useState(true)

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: cfg.border }}>
      {/* Section header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3"
        style={{ background: cfg.bg }}>
        <div className="flex items-center gap-2">
          {open ? <ChevronUp size={14} style={{ color: cfg.color }} /> : <ChevronDown size={14} style={{ color: cfg.color }} />}
          <span className="text-sm font-semibold" style={{ color: cfg.color }}>{status}</span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: `color-mix(in srgb, ${cfg.color} 20%, transparent)`, color: cfg.color }}>
            {docs.length}
          </span>
        </div>
      </button>

      {open && (
        <>
          {/* Column headers */}
          <div className="grid grid-cols-12 px-5 py-2 text-xs font-medium border-b"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
            <span className="col-span-2">Doc No.</span>
            <span className="col-span-4">Title</span>
            <span className="col-span-1">Rev</span>
            <span className="col-span-1">Type</span>
            <span className="col-span-2">Move to</span>
            <span className="col-span-1">Size</span>
            <span className="col-span-1 text-right">Actions</span>
          </div>

          {docs.map(doc => {
            const revs = byDocNo[doc.doc_no] ?? []
            const detailOpen = expandedDetail.has(doc.doc_no)
            const errMsg = statusError[doc.id]

            return (
              <div key={doc.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                <div className="grid grid-cols-12 px-5 py-3 items-center" style={{ background: 'var(--bg-surface)' }}>
                  <span className="col-span-2 text-sm font-mono font-medium" style={{ color: 'var(--accent)' }}>
                    {doc.doc_no}
                  </span>
                  <span className="col-span-4 text-sm truncate pr-2" style={{ color: 'var(--text-primary)' }}>{doc.title}</span>
                  <span className="col-span-1 text-xs font-mono px-1.5 py-0.5 rounded w-fit"
                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                    {doc.rev}
                  </span>
                  <span className="col-span-1 text-xs" style={{ color: 'var(--text-muted)' }}>{doc.type}</span>

                  {/* Move to dropdown */}
                  <div className="col-span-2">
                    {canEdit && doc.storage_path ? (
                      <select
                        value=""
                        disabled={statusChanging === doc.id}
                        onChange={e => { if (e.target.value) onStatusChange(doc.id, e.target.value as DocStatus); e.target.value = '' }}
                        className="text-[10px] rounded border px-1.5 py-0.5 outline-none cursor-pointer disabled:opacity-50 w-full"
                        style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                        <option value="">Move to…</option>
                        {STATUSES.filter(s => s !== status).map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    ) : <span />}
                  </div>

                  {/* Size / no-file warning */}
                  <span className="col-span-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {doc.storage_path ? (
                      <span className="flex flex-col gap-0.5">
                        <span>{formatBytes(doc.file_size)}</span>
                        {(doc as any).mime_type && (doc as any).mime_type !== 'application/pdf' && (
                          <span className="flex items-center gap-1 text-[10px]" style={{ color: '#fb923c' }}
                            title="Non-PDF — AI review unavailable">
                            <AlertCircle size={10} /> Not PDF
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1" style={{ color: 'var(--major)' }}>
                        <AlertCircle size={11} /> No file
                      </span>
                    )}
                  </span>

                  {/* Actions */}
                  <div className="col-span-1 flex justify-end items-center gap-1">
                    {doc.storage_path ? (
                      <button onClick={() => onDownload(doc)} title="Download"
                        className="p-1 rounded hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
                        <Download size={14} />
                      </button>
                    ) : canEdit ? (
                      <>
                        <input type="file" className="hidden"
                          accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.xlsx,.docx"
                          onChange={e => { onAttachFile(e.target.files?.[0]); e.target.value = '' }}
                          ref={el => { if (attachingDoc?.id === doc.id) attachInputRef.current = el }} />
                        <button onClick={() => onAttachDoc(doc)}
                          title="Attach file" disabled={attachingId === doc.id}
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs border hover:opacity-80 disabled:opacity-50"
                          style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>
                          {attachingId === doc.id ? '…' : <><Paperclip size={11} /> Attach</>}
                        </button>
                      </>
                    ) : null}
                    {canEdit && doc.storage_path && (
                      <button onClick={() => onToggleClientReview(doc)}
                        title={(doc as any).for_client_review ? 'Remove from client review' : 'Share with client'}
                        className="p-1 rounded hover:opacity-70"
                        style={{ color: (doc as any).for_client_review ? '#4ade80' : 'var(--text-muted)' }}>
                        {(doc as any).for_client_review ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedDetail(prev => {
                        const next = new Set(prev)
                        next.has(doc.doc_no) ? next.delete(doc.doc_no) : next.add(doc.doc_no)
                        return next
                      })}
                      title={detailOpen ? 'Collapse' : 'View history & comments'}
                      className="p-1 rounded hover:opacity-70"
                      style={{ color: detailOpen ? 'var(--accent)' : 'var(--text-muted)' }}>
                      {detailOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {errMsg && (
                  <div className="mx-5 mb-2 text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
                    {errMsg}
                  </div>
                )}

                {detailOpen && (
                  <DocumentDetailPanel
                    documentId={doc.id}
                    allRevisions={revs as any}
                    canEdit={canEdit}
                    userRole={userRole}
                    onDownload={onDownload as any}
                  />
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
