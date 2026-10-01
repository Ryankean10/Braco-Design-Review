'use client'

import { useState } from 'react'
import { Download, Archive, ChevronRight } from 'lucide-react'

interface QcsDoc {
  id: string
  title: string
  reference_no: string | null
  status: string
  location: string | null
  generated_by_name: string | null
  approved_by_name: string | null
  pdf_storage_path: string | null
}

interface Props {
  projectId: string
  docs: QcsDoc[]
  canEdit: boolean
}

const STATUS_COLOR: Record<string, string> = {
  wip:        '#f59e0b',
  act_review: '#6366f1',
  submitted:  '#22c55e',
}
const STATUS_LABEL: Record<string, string> = {
  wip:        'WIP',
  act_review: 'ACT Review',
  submitted:  'Submitted to Client',
}
const STATUS_ORDER = ['wip', 'act_review', 'submitted']

export default function QcsDocList({ projectId, docs, canEdit }: Props) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [zipping, setZipping] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null)
  const [localDocs, setLocalDocs] = useState<QcsDoc[]>(docs)

  const openDocs      = localDocs.filter(q => q.status === 'wip' || q.status === 'act_review')
  const submittedDocs = localDocs.filter(q => q.status === 'submitted')

  async function downloadOne(doc: QcsDoc) {
    if (downloadingId) return
    setDownloadingId(doc.id)
    try {
      const a = document.createElement('a')
      a.href = `/api/projects/${projectId}/qcs/${doc.id}/download`
      a.download = ''
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } finally {
      setTimeout(() => setDownloadingId(null), 1000)
    }
  }

  async function downloadAll() {
    if (zipping) return
    setZipping(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/qcs/download-all`)
      if (!res.ok) { setZipping(false); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const cd   = res.headers.get('Content-Disposition') ?? ''
      const name = cd.match(/filename="([^"]+)"/)?.[1] ?? 'QCS Pack.zip'
      const a    = document.createElement('a')
      a.href = url; a.download = name
      document.body.appendChild(a); a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setZipping(false)
    }
  }

  async function advanceStatus(doc: QcsDoc) {
    const idx  = STATUS_ORDER.indexOf(doc.status)
    const next = STATUS_ORDER[idx + 1]
    if (!next || statusUpdating) return
    setStatusUpdating(doc.id)
    try {
      const res = await fetch(`/api/projects/${projectId}/qcs/${doc.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (res.ok) {
        setLocalDocs(prev => prev.map(d => d.id === doc.id ? { ...d, status: next } : d))
      }
    } finally {
      setStatusUpdating(null)
    }
  }

  if (localDocs.length === 0) return null

  return (
    <div className="space-y-4">

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {localDocs.length} document{localDocs.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={downloadAll}
          disabled={zipping}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            opacity: zipping ? 0.6 : 1,
            cursor: zipping ? 'wait' : 'pointer',
          }}>
          <Archive size={12} />
          {zipping ? 'Building ZIP…' : 'Download all as ZIP'}
        </button>
      </div>

      {/* In progress */}
      {openDocs.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
            In progress
          </p>
          <div className="space-y-1.5">
            {openDocs.map(q => (
              <QcsRow
                key={q.id}
                doc={q}
                canEdit={canEdit}
                downloading={downloadingId === q.id}
                statusUpdating={statusUpdating === q.id}
                onDownload={() => downloadOne(q)}
                onAdvance={() => advanceStatus(q)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Submitted */}
      {submittedDocs.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
            Submitted to Client
          </p>
          <div className="space-y-1.5">
            {submittedDocs.map(q => (
              <QcsRow
                key={q.id}
                doc={q}
                canEdit={canEdit}
                downloading={downloadingId === q.id}
                statusUpdating={statusUpdating === q.id}
                onDownload={() => downloadOne(q)}
                onAdvance={() => advanceStatus(q)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function QcsRow({
  doc, canEdit, downloading, statusUpdating, onDownload, onAdvance,
}: {
  doc: QcsDoc
  canEdit: boolean
  downloading: boolean
  statusUpdating: boolean
  onDownload: () => void
  onAdvance: () => void
}) {
  const color = STATUS_COLOR[doc.status] ?? '#64748b'
  const label = STATUS_LABEL[doc.status] ?? doc.status
  const canAdvance = canEdit && doc.status !== 'submitted'

  return (
    <div
      className="rounded-xl border px-4 py-3 flex items-center gap-3"
      style={{
        background: doc.status === 'submitted' ? '#0d2818' : 'var(--bg-surface)',
        borderColor: doc.status === 'submitted' ? '#22c55e33' : 'var(--border)',
      }}>

      {/* Title + ref */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {doc.title}
          </p>
          {doc.reference_no && (
            <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>
              {doc.reference_no}
            </span>
          )}
        </div>
        {doc.location && (
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{doc.location}</p>
        )}
      </div>

      {/* Status badge */}
      <span
        className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
        style={{ background: color + '22', color }}>
        {label}
      </span>

      {/* Advance status */}
      {canAdvance && (
        <button
          onClick={onAdvance}
          disabled={statusUpdating}
          title={`Move to ${STATUS_LABEL[['wip','act_review','submitted'][['wip','act_review','submitted'].indexOf(doc.status)+1]] ?? ''}`}
          className="shrink-0 rounded-lg px-2 py-1 text-xs flex items-center gap-1 transition-opacity"
          style={{
            background: color + '22',
            color,
            opacity: statusUpdating ? 0.5 : 1,
            cursor: statusUpdating ? 'wait' : 'pointer',
          }}>
          <ChevronRight size={12} />
        </button>
      )}

      {/* Download */}
      {doc.pdf_storage_path && (
        <button
          onClick={onDownload}
          disabled={downloading}
          title="Download DOCX"
          className="shrink-0 p-1.5 rounded-lg transition-opacity"
          style={{
            color: 'var(--text-muted)',
            opacity: downloading ? 0.4 : 1,
            cursor: downloading ? 'wait' : 'pointer',
          }}>
          <Download size={14} />
        </button>
      )}
    </div>
  )
}
