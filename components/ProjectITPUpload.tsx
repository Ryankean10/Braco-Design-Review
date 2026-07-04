'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, Download, Trash2, Loader2, ClipboardList } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface ITP {
  id: string
  file_name: string
  storage_path: string
  file_size: number | null
  description: string | null
  uploaded_at: string
}

interface Props {
  projectId: string
  initialItps: ITP[]
  canEdit: boolean
}

function fmtSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ProjectITPUpload({ projectId, initialItps, canEdit }: Props) {
  const [itps, setItps] = useState<ITP[]>(initialItps)
  const [uploading, setUploading] = useState(false)
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  async function handleUpload(file: File) {
    if (!file) return
    setUploading(true)
    setError('')

    const path = `itps/${projectId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`

    const { error: upErr } = await supabase.storage
      .from('documents')
      .upload(path, file, { upsert: false })

    if (upErr) { setError(upErr.message); setUploading(false); return }

    const { data, error: dbErr } = await supabase
      .from('project_itps')
      .insert({
        project_id: projectId,
        file_name: file.name,
        storage_path: path,
        file_size: file.size,
        description: description.trim() || null,
      })
      .select()
      .single()

    if (dbErr) { setError(dbErr.message); setUploading(false); return }

    setItps(prev => [data as ITP, ...prev])
    setDescription('')
    setShowForm(false)
    setUploading(false)
  }

  async function handleDownload(itp: ITP) {
    const { data } = await supabase.storage.from('documents').createSignedUrl(itp.storage_path, 120)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function handleDelete(itp: ITP) {
    await supabase.storage.from('documents').remove([itp.storage_path])
    await supabase.from('project_itps').delete().eq('id', itp.id)
    setItps(prev => prev.filter(i => i.id !== itp.id))
  }

  return (
    <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ClipboardList size={15} style={{ color: 'var(--accent)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Inspection & Test Plan (ITP)
          </h3>
          {itps.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
              {itps.length}
            </span>
          )}
        </div>
        {canEdit && (
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border hover:opacity-80 transition-opacity"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            <Upload size={11} /> Upload ITP
          </button>
        )}
      </div>

      {/* Upload form */}
      {showForm && canEdit && (
        <div className="rounded-lg border p-4 mb-4 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Description <span className="font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Civils ITP Rev 2 — Dyce BESS"
              className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed text-sm hover:opacity-80 disabled:opacity-50 transition-opacity"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
          >
            {uploading ? <><Loader2 size={13} className="animate-spin" />Uploading…</> : <><Upload size={13} />Choose PDF or Excel file</>}
          </button>
          {error && <p className="text-xs" style={{ color: 'var(--critical)' }}>{error}</p>}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.xlsx,.xls,.csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }}
          />
        </div>
      )}

      {/* ITP list */}
      {itps.length === 0 && !showForm && (
        <div className="text-center py-6">
          <ClipboardList size={24} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-muted)' }} />
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            No ITP uploaded yet.{canEdit ? ' Use the button above to attach one.' : ''}
          </p>
        </div>
      )}

      {itps.length > 0 && (
        <div className="space-y-2">
          {itps.map(itp => (
            <div key={itp.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 border"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}
            >
              <FileText size={14} className="shrink-0" style={{ color: 'var(--accent)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {itp.description || itp.file_name}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {itp.description ? itp.file_name + ' · ' : ''}
                  {fmtSize(itp.file_size)}
                  {' · '}
                  {new Date(itp.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => handleDownload(itp)} title="Download"
                  className="hover:opacity-80" style={{ color: 'var(--accent)' }}>
                  <Download size={13} />
                </button>
                {canEdit && (
                  <button onClick={() => handleDelete(itp)} title="Remove"
                    className="hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
