'use client'

import { useState, useRef } from 'react'
import { Upload, Download, FileText, Sparkles, ChevronDown, ChevronUp, ChevronRight,
         FileSpreadsheet, AlertCircle, Loader2, CheckCircle2, Info, ShieldAlert, HardHat,
         BookOpen, GitCompareArrows, Tag } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const SOURCES = ['Manufacturer', 'Planning Authority', 'DNO/NESO', 'Consultant', 'Contractor', 'Other'] as const
const DOC_TYPES = ['Manual', 'Study', 'Report', 'Specification', 'Drawing', 'Test Certificate', 'Planning Document', 'Other'] as const

type TechSource = typeof SOURCES[number]
type TechDocType = typeof DOC_TYPES[number]
type AnalysisStatus = 'pending' | 'running' | 'complete' | 'error'

type FindingCategory = 'specification' | 'compliance_check' | 'lessons_learned' | 'construction' | 'safety' | 'general'
type FindingSeverity = 'High' | 'Medium' | 'Low' | 'Information'

interface TechFinding {
  category: FindingCategory
  severity: FindingSeverity
  title: string
  detail: string
  value_extracted?: string
  cross_ref?: string
  page_ref?: string
}

interface TechAnalysis {
  id: string
  status: AnalysisStatus
  findings: TechFinding[] | null
  raw_summary: string | null
  error: string | null
  created_at: string
  completed_at: string | null
}

interface TechDoc {
  id: string
  project_id: string
  title: string
  doc_ref: string | null
  source: TechSource
  doc_type: TechDocType
  notes: string | null
  storage_path: string | null
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  created_at: string
  tech_doc_analyses?: TechAnalysis[]
}

interface Props {
  projectId: string
  initialDocs: TechDoc[]
  userRole: string
}

const CATEGORY_CFG: Record<FindingCategory, { label: string; color: string; icon: React.ReactNode }> = {
  specification:    { label: 'Specification',    color: '#60a5fa', icon: <Tag size={11} /> },
  compliance_check: { label: 'Compliance Check', color: '#f472b6', icon: <GitCompareArrows size={11} /> },
  lessons_learned:  { label: 'Lessons Learned',  color: '#fb923c', icon: <BookOpen size={11} /> },
  construction:     { label: 'Construction',     color: '#a78bfa', icon: <HardHat size={11} /> },
  safety:           { label: 'Safety',           color: '#f87171', icon: <ShieldAlert size={11} /> },
  general:          { label: 'General',          color: '#94a3b8', icon: <Info size={11} /> },
}

const SEV_CFG: Record<FindingSeverity, { color: string; bg: string }> = {
  High:        { color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  Medium:      { color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  Low:         { color: '#facc15', bg: 'rgba(250,204,21,0.12)' },
  Information: { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function TechnicalLibrary({ projectId, initialDocs, userRole }: Props) {
  const [docs, setDocs] = useState<TechDoc[]>(initialDocs)
  const [showUpload, setShowUpload] = useState(false)
  const [showCsv, setShowCsv] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [analysing, setAnalysing] = useState<Set<string>>(new Set())
  const csvInputRef = useRef<HTMLInputElement | null>(null)

  // Upload form state
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [docRef, setDocRef] = useState('')
  const [source, setSource] = useState<TechSource>('Manufacturer')
  const [docType, setDocType] = useState<TechDocType>('Manual')
  const [notes, setNotes] = useState('')

  const canEdit = ['admin', 'engineer'].includes(userRole)
  const canAnalyse = ['admin', 'engineer'].includes(userRole)

  function resetForm() {
    setFile(null); setTitle(''); setDocRef(''); setSource('Manufacturer')
    setDocType('Manual'); setNotes(''); setUploadError('')
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setUploading(true); setUploadError('')

    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const storagePath = `${projectId}/tech/${Date.now()}-${title.replace(/\s+/g, '_').substring(0, 40)}.${ext}`

    const { error: storageErr } = await supabase.storage
      .from('documents')
      .upload(storagePath, file, { upsert: false })
    if (storageErr) { setUploadError(storageErr.message); setUploading(false); return }

    const res = await fetch('/api/technical-documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        title: title.trim(),
        doc_ref: docRef.trim() || null,
        source, doc_type: docType,
        notes: notes.trim() || null,
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
      }),
    })

    const data = await res.json()
    if (!res.ok) { setUploadError(data.error); setUploading(false); return }

    setDocs(prev => [{ ...data, tech_doc_analyses: [] }, ...prev])
    setShowUpload(false); resetForm(); setUploading(false)
  }

  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const csvFile = e.target.files?.[0]
    if (!csvFile) return
    const text = await csvFile.text()
    const lines = text.split('\n').filter(l => l.trim())
    const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
    const rows = lines.slice(1)

    let imported = 0
    for (const row of rows) {
      const cols = row.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      const obj: Record<string, string> = {}
      header.forEach((h, i) => { obj[h] = cols[i] ?? '' })
      if (!obj.title) continue

      const res = await fetch('/api/technical-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          title: obj.title,
          doc_ref: obj.doc_ref || obj.ref || null,
          source: SOURCES.includes(obj.source as TechSource) ? obj.source : 'Other',
          doc_type: DOC_TYPES.includes(obj.doc_type as TechDocType) ? obj.doc_type : 'Manual',
          notes: obj.notes || null,
        }),
      })
      if (res.ok) {
        const d = await res.json()
        setDocs(prev => [{ ...d, tech_doc_analyses: [] }, ...prev])
        imported++
      }
    }
    alert(`Imported ${imported} record${imported !== 1 ? 's' : ''}`)
    e.target.value = ''
  }

  async function handleDownload(doc: TechDoc) {
    if (!doc.storage_path) return
    const supabase = createClient()
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 120)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function runAnalysis(doc: TechDoc) {
    setAnalysing(prev => new Set(prev).add(doc.id))
    try {
      const res = await fetch(`/api/technical-documents/${doc.id}/analyse`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        // Re-fetch the latest analysis for this doc
        const supabase = createClient()
        const { data: analyses } = await supabase
          .from('tech_doc_analyses')
          .select('*')
          .eq('tech_document_id', doc.id)
          .order('created_at', { ascending: false })
          .limit(1)
        setDocs(prev => prev.map(d => d.id === doc.id
          ? { ...d, tech_doc_analyses: analyses ?? [] }
          : d
        ))
        // Auto-expand
        setExpanded(prev => new Set(prev).add(doc.id))
      }
    } finally {
      setAnalysing(prev => { const next = new Set(prev); next.delete(doc.id); return next })
    }
  }

  const fieldStyle = {
    background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)',
  }

  // Group by source
  const bySource = docs.reduce<Record<string, TechDoc[]>>((acc, doc) => {
    if (!acc[doc.source]) acc[doc.source] = []
    acc[doc.source].push(doc)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {docs.length} document{docs.length !== 1 ? 's' : ''}
        </p>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={() => csvInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border hover:opacity-80"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
              <FileSpreadsheet size={14} /> Import CSV
            </button>
            <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
            <button onClick={() => { setShowUpload(!showUpload); resetForm() }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90"
              style={{ background: 'var(--accent)' }}>
              <Upload size={14} /> Add document
            </button>
          </div>
        )}
      </div>

      {/* CSV template hint */}
      {showCsv && (
        <div className="text-xs rounded-lg px-4 py-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          CSV columns: <code className="font-mono">title, doc_ref, source, doc_type, notes</code>
        </div>
      )}

      {/* Upload form */}
      {showUpload && (
        <form onSubmit={handleUpload} className="rounded-xl border p-5 space-y-4"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Add technical document</h3>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>File</label>
            <input type="file" accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.xlsx,.docx"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm rounded-lg px-3 py-2 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:text-white"
              style={fieldStyle} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} required
                className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={fieldStyle}
                placeholder="e.g. SolBank Pro 2MWh Installation Manual" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Reference / Part No.</label>
              <input value={docRef} onChange={e => setDocRef(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={fieldStyle}
                placeholder="e.g. SB-IM-2024-003" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Source *</label>
              <select value={source} onChange={e => setSource(e.target.value as TechSource)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={fieldStyle}>
                {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Document type *</label>
              <select value={docType} onChange={e => setDocType(e.target.value as TechDocType)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={fieldStyle}>
                {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={fieldStyle}
                placeholder="Brief description or context" />
            </div>
          </div>

          {uploadError && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ background: '#3f1212', color: '#f87171' }}>{uploadError}</p>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => { setShowUpload(false); resetForm() }}
              className="text-sm px-4 py-2 rounded-lg border"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>Cancel</button>
            <button type="submit" disabled={uploading || !title}
              className="text-sm px-4 py-2 rounded-lg font-medium text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}>{uploading ? 'Uploading…' : 'Add document'}</button>
          </div>
        </form>
      )}

      {/* Document list */}
      {docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-xl border"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <FileText size={36} style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No technical documents added yet</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Add manuals, studies, and received information here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(bySource).map(([src, sourceDocs]) => (
            <SourceSection
              key={src}
              source={src}
              docs={sourceDocs}
              expanded={expanded}
              setExpanded={setExpanded}
              analysing={analysing}
              canEdit={canEdit}
              canAnalyse={canAnalyse}
              onDownload={handleDownload}
              onAnalyse={runAnalysis}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SourceSection({ source, docs, expanded, setExpanded, analysing, canEdit, canAnalyse, onDownload, onAnalyse }: {
  source: string
  docs: TechDoc[]
  expanded: Set<string>
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>
  analysing: Set<string>
  canEdit: boolean
  canAnalyse: boolean
  onDownload: (doc: TechDoc) => void
  onAnalyse: (doc: TechDoc) => void
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3"
        style={{ background: 'var(--bg-elevated)' }}>
        <div className="flex items-center gap-2">
          {open ? <ChevronUp size={14} style={{ color: 'var(--accent)' }} /> : <ChevronDown size={14} style={{ color: 'var(--accent)' }} />}
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{source}</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: 'rgba(108,114,245,0.12)', color: 'var(--accent)' }}>{docs.length}</span>
        </div>
      </button>

      {open && (
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {docs.map(doc => {
            const isExpanded = expanded.has(doc.id)
            const latestAnalysis = (doc.tech_doc_analyses ?? [])[0]
            const isAnalysing = analysing.has(doc.id)

            return (
              <div key={doc.id} style={{ background: 'var(--bg-surface)' }}>
                {/* Doc row */}
                <div className="flex items-center gap-3 px-5 py-3">
                  <FileText size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{doc.title}</span>
                      {doc.doc_ref && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>{doc.doc_ref}</span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(108,114,245,0.08)', color: 'var(--accent)' }}>{doc.doc_type}</span>
                    </div>
                    {doc.notes && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{doc.notes}</p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {doc.file_name && <span>{doc.file_name} ({formatBytes(doc.file_size)})</span>}
                      {latestAnalysis && latestAnalysis.status === 'complete' && (
                        <span className="flex items-center gap-1" style={{ color: '#4ade80' }}>
                          <CheckCircle2 size={10} />
                          {(latestAnalysis.findings ?? []).length} finding{(latestAnalysis.findings ?? []).length !== 1 ? 's' : ''} analysed
                        </span>
                      )}
                      {latestAnalysis && latestAnalysis.status === 'error' && (
                        <span className="flex items-center gap-1" style={{ color: '#f87171' }}>
                          <AlertCircle size={10} /> Analysis error
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {doc.storage_path && (
                      <button onClick={() => onDownload(doc)}
                        className="p-1.5 rounded-lg hover:opacity-70" title="Download"
                        style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)' }}>
                        <Download size={13} />
                      </button>
                    )}
                    {canAnalyse && doc.storage_path && doc.mime_type === 'application/pdf' && (
                      <button
                        onClick={() => onAnalyse(doc)}
                        disabled={isAnalysing}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-60"
                        style={{ background: isAnalysing ? 'var(--bg-elevated)' : 'rgba(108,114,245,0.15)', color: 'var(--accent)' }}
                        title="Run AI analysis">
                        {isAnalysing
                          ? <><Loader2 size={11} className="animate-spin" /> Analysing…</>
                          : <><Sparkles size={11} /> Analyse</>
                        }
                      </button>
                    )}
                    {latestAnalysis?.findings && latestAnalysis.findings.length > 0 && (
                      <button
                        onClick={() => setExpanded(prev => {
                          const next = new Set(prev)
                          next.has(doc.id) ? next.delete(doc.id) : next.add(doc.id)
                          return next
                        })}
                        className="p-1.5 rounded-lg hover:opacity-70"
                        style={{ color: isExpanded ? 'var(--accent)' : 'var(--text-muted)', background: 'var(--bg-elevated)' }}>
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Analysis results */}
                {isExpanded && latestAnalysis?.findings && (
                  <div className="border-t px-5 py-4 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
                    {latestAnalysis.raw_summary && (
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{latestAnalysis.raw_summary}</p>
                    )}

                    {/* Group findings by category */}
                    {(Object.keys(CATEGORY_CFG) as FindingCategory[]).map(cat => {
                      const catFindings = latestAnalysis.findings!.filter(f => f.category === cat)
                      if (catFindings.length === 0) return null
                      const cfg = CATEGORY_CFG[cat]
                      return (
                        <div key={cat}>
                          <div className="flex items-center gap-1.5 mb-2">
                            <span style={{ color: cfg.color }}>{cfg.icon}</span>
                            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: cfg.color }}>{cfg.label}</span>
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>({catFindings.length})</span>
                          </div>
                          <div className="space-y-2">
                            {catFindings.map((f, i) => {
                              const sevCfg = SEV_CFG[f.severity]
                              return (
                                <div key={i} className="rounded-lg px-3 py-2.5" style={{ background: sevCfg.bg, border: `1px solid ${sevCfg.color}30` }}>
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{f.title}</p>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      {f.page_ref && (
                                        <span className="text-[9px] px-1 rounded" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>p.{f.page_ref}</span>
                                      )}
                                      <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ color: sevCfg.color, background: 'var(--bg-surface)' }}>
                                        {f.severity}
                                      </span>
                                    </div>
                                  </div>
                                  <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{f.detail}</p>
                                  {f.value_extracted && (
                                    <p className="text-[10px] mt-1 font-mono px-2 py-1 rounded" style={{ background: 'var(--bg-surface)', color: cfg.color }}>
                                      {f.value_extracted}
                                    </p>
                                  )}
                                  {f.cross_ref && (
                                    <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: '#fb923c' }}>
                                      <GitCompareArrows size={9} /> Check against: {f.cross_ref}
                                    </p>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
