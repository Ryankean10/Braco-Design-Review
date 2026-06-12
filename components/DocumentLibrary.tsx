'use client'

import { useState, useRef } from 'react'
import { Upload, Download, FileText, ChevronUp, History, FileSpreadsheet, Paperclip, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import DocumentImport from '@/components/DocumentImport'
import DocumentBulkAttach from '@/components/DocumentBulkAttach'
import type { Document, DocType, Stage } from '@/lib/types'

const DOC_TYPES: DocType[] = ['Drawing', 'Specification', 'Report', 'Schedule', 'Certificate', 'Other']
const STAGES: Stage[] = ['Feasibility', 'Design', 'Procure', 'Build & Install', 'Test & Commission', 'Energise & Handover']

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
  const [expandedRevs, setExpandedRevs] = useState<Set<string>>(new Set())
  const [attachingId, setAttachingId] = useState<string | null>(null)
  const attachInputRef = useRef<HTMLInputElement | null>(null)
  const [attachingDoc, setAttachingDoc] = useState<Document | null>(null)

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
    setUploading(true)
    setUploadError('')

    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const storagePath = `${projectId}/${Date.now()}-${docNo.replace(/\s+/g, '_')}-${rev}.${ext}`

    const { error: storageErr } = await supabase.storage
      .from('documents')
      .upload(storagePath, file, { upsert: false })

    if (storageErr) { setUploadError(storageErr.message); setUploading(false); return }

    const payload: Partial<Document> = {
      project_id: projectId,
      doc_no: docNo.trim(),
      title: title.trim(),
      rev: rev.trim(),
      type: docType,
      stage,
      storage_path: storagePath,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      supersedes: supersedes || null,
    }

    const { data, error: dbErr } = await supabase
      .from('documents')
      .insert(payload)
      .select()
      .single()

    if (dbErr) { setUploadError(dbErr.message); setUploading(false); return }

    setDocuments(prev => [data, ...prev])
    setShowUpload(false)
    resetForm()
    setUploading(false)
  }

  async function handleQuickAttach(doc: Document, file: File) {
    setAttachingId(doc.id)
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const storagePath = `${projectId}/${Date.now()}-${doc.doc_no.replace(/\s+/g, '_')}-${doc.rev}.${ext}`

    const { error: storageErr } = await supabase.storage
      .from('documents')
      .upload(storagePath, file, { upsert: false })

    if (!storageErr) {
      await supabase.from('documents').update({
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
      }).eq('id', doc.id)

      setDocuments(prev => prev.map(d => d.id === doc.id
        ? { ...d, storage_path: storagePath, file_name: file.name, file_size: file.size, mime_type: file.type }
        : d
      ))
    }
    setAttachingId(null)
    setAttachingDoc(null)
  }

  async function handleDownload(doc: Document) {
    const supabase = createClient()
    const { data } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function toggleClientReview(doc: Document) {
    const supabase = createClient()
    const next = !(doc as any).for_client_review
    await supabase.from('documents').update({ for_client_review: next }).eq('id', doc.id)
    setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, for_client_review: next } as any : d))
  }

  const canEdit = ['admin', 'engineer'].includes(userRole)

  // Group by doc_no for revision history display
  const byDocNo = documents.reduce<Record<string, Document[]>>((acc, doc) => {
    if (!acc[doc.doc_no]) acc[doc.doc_no] = []
    acc[doc.doc_no].push(doc)
    return acc
  }, {})

  // Latest revision per doc_no
  const latestDocs = Object.values(byDocNo).map(revs => revs[0])

  const fieldStyle = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {latestDocs.length} document{latestDocs.length !== 1 ? 's' : ''}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowBulkAttach(!showBulkAttach); setShowImport(false); setShowUpload(false) }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-opacity hover:opacity-80"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
          >
            <Paperclip size={14} />
            Attach files
          </button>
          <button
            onClick={() => { setShowImport(!showImport); setShowBulkAttach(false); setShowUpload(false) }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-opacity hover:opacity-80"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
          >
            <FileSpreadsheet size={14} />
            Import CSV
          </button>
          <button
            onClick={() => { setShowUpload(!showUpload); setShowImport(false); resetForm() }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity"
            style={{ background: 'var(--accent)' }}
          >
            <Upload size={14} />
            Upload document
          </button>
        </div>
      </div>

      {/* Bulk attach */}
      {showBulkAttach && (
        <DocumentBulkAttach
          projectId={projectId}
          documents={documents}
          onDone={() => { setShowBulkAttach(false); window.location.reload() }}
          onClose={() => setShowBulkAttach(false)}
        />
      )}

      {/* CSV Import */}
      {showImport && (
        <DocumentImport
          projectId={projectId}
          onImported={(count) => {
            setShowImport(false)
            // Reload page to show imported docs
            window.location.reload()
          }}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* Upload form */}
      {showUpload && (
        <form
          onSubmit={handleUpload}
          className="rounded-xl border p-5 space-y-4"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
        >
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Upload document</h3>

          {/* File picker */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>File *</label>
            <input
              type="file"
              required
              accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.xlsx,.docx"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm rounded-lg px-3 py-2 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:text-white"
              style={{ ...fieldStyle, fileBackground: 'var(--accent)' } as React.CSSProperties}
            />
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
                className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={fieldStyle}
                placeholder="e.g. P01" />
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

          {/* Supersedes (for new revisions) */}
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
            <p className="text-sm rounded-lg px-3 py-2" style={{ background: '#3f1212', color: '#f87171' }}>
              {uploadError}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => { setShowUpload(false); resetForm() }}
              className="text-sm px-4 py-2 rounded-lg border"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
              Cancel
            </button>
            <button type="submit" disabled={uploading}
              className="text-sm px-4 py-2 rounded-lg font-medium text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </form>
      )}

      {/* Document table */}
      <div className="rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        {latestDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <FileText size={36} style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No documents uploaded yet</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="grid grid-cols-12 px-5 py-2.5 text-xs font-medium border-b"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
              <span className="col-span-2">Doc No.</span>
              <span className="col-span-4">Title</span>
              <span className="col-span-1">Rev</span>
              <span className="col-span-1">Type</span>
              <span className="col-span-2">Stage</span>
              <span className="col-span-1">Size</span>
              <span className="col-span-1 text-right">Actions</span>
            </div>

            {latestDocs.map(doc => {
              const revs = byDocNo[doc.doc_no] ?? []
              const hasHistory = revs.length > 1
              const expanded = expandedRevs.has(doc.doc_no)

              return (
                <div key={doc.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                  {/* Latest revision row */}
                  <div className="grid grid-cols-12 px-5 py-3 items-center">
                    <span className="col-span-2 text-sm font-mono font-medium" style={{ color: 'var(--accent)' }}>
                      {doc.doc_no}
                    </span>
                    <span className="col-span-4 text-sm" style={{ color: 'var(--text-primary)' }}>{doc.title}</span>
                    <span className="col-span-1 text-xs font-mono px-1.5 py-0.5 rounded w-fit"
                      style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                      {doc.rev}
                    </span>
                    <span className="col-span-1 text-xs" style={{ color: 'var(--text-muted)' }}>{doc.type}</span>
                    <span className="col-span-2">
                      <span className="chip-stage text-xs px-2 py-0.5 rounded-full">{doc.stage}</span>
                    </span>
                    <span className="col-span-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {doc.storage_path ? (
                        <span className="flex flex-col gap-0.5">
                          <span>{formatBytes(doc.file_size)}</span>
                          {doc.mime_type && doc.mime_type !== 'application/pdf' && (
                            <span className="flex items-center gap-1 text-[10px]" style={{ color: '#fb923c' }} title="Non-PDF files cannot be used in AI design reviews — replace with a searchable PDF export">
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
                    <div className="col-span-1 flex justify-end items-center gap-1.5">
                      {doc.storage_path ? (
                        <button onClick={() => handleDownload(doc)} title="Download"
                          className="p-1 rounded hover:opacity-70 transition-opacity"
                          style={{ color: 'var(--text-muted)' }}>
                          <Download size={14} />
                        </button>
                      ) : (
                        <>
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.xlsx,.docx"
                            onChange={e => {
                              const f = e.target.files?.[0]
                              if (f && attachingDoc) handleQuickAttach(attachingDoc, f)
                              e.target.value = ''
                            }}
                            ref={el => { if (attachingDoc?.id === doc.id) attachInputRef.current = el }}
                          />
                          <button
                            onClick={() => {
                              setAttachingDoc(doc)
                              setTimeout(() => attachInputRef.current?.click(), 50)
                            }}
                            title="Attach file"
                            disabled={attachingId === doc.id}
                            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs border transition-opacity hover:opacity-80 disabled:opacity-50"
                            style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>
                            {attachingId === doc.id ? '…' : <><Paperclip size={11} /> Attach</>}
                          </button>
                        </>
                      )}
                      {canEdit && doc.storage_path && (
                        <button
                          onClick={() => toggleClientReview(doc)}
                          title={(doc as any).for_client_review ? 'Remove from client review' : 'Share with client'}
                          className="p-1 rounded hover:opacity-70 transition-opacity"
                          style={{ color: (doc as any).for_client_review ? '#4ade80' : 'var(--text-muted)' }}>
                          {(doc as any).for_client_review ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                      )}
                      {hasHistory && (
                        <button
                          onClick={() => setExpandedRevs(prev => {
                            const next = new Set(prev)
                            next.has(doc.doc_no) ? next.delete(doc.doc_no) : next.add(doc.doc_no)
                            return next
                          })}
                          title="Revision history"
                          className="p-1 rounded hover:opacity-70 transition-opacity"
                          style={{ color: 'var(--text-muted)' }}>
                          {expanded ? <ChevronUp size={14} /> : <History size={14} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Revision history */}
                  {expanded && revs.slice(1).map(older => (
                    <div key={older.id}
                      className="grid grid-cols-12 px-5 py-2 items-center border-t"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
                      <span className="col-span-2 text-xs" style={{ color: 'var(--text-muted)' }}>↳ superseded</span>
                      <span className="col-span-4 text-xs" style={{ color: 'var(--text-muted)' }}>{older.title}</span>
                      <span className="col-span-1 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{older.rev}</span>
                      <span className="col-span-1 text-xs" style={{ color: 'var(--text-muted)' }}>{older.type}</span>
                      <span className="col-span-2 text-xs" style={{ color: 'var(--text-muted)' }}>{older.stage}</span>
                      <span className="col-span-1 text-xs" style={{ color: 'var(--text-muted)' }}>{formatBytes(older.file_size)}</span>
                      <div className="col-span-1 flex justify-end">
                        <button onClick={() => handleDownload(older)} title="Download"
                          className="p-1 rounded hover:opacity-70 transition-opacity"
                          style={{ color: 'var(--text-muted)' }}>
                          <Download size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
