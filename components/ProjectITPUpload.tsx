'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, Download, Trash2, Loader2, ClipboardList, CheckCircle2, Zap } from 'lucide-react'
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
  siteId: string | null
  initialItps: ITP[]
  canEdit: boolean
}

function fmtSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const STAGES = [
  'Uploading file…',
  'Extracting ITP content…',
  'AI analysing civils scope…',
  'Seeding activity register…',
]

export default function ProjectITPUpload({ projectId, siteId, initialItps, canEdit }: Props) {
  const [itps, setItps] = useState<ITP[]>(initialItps)
  const [uploading, setUploading] = useState(false)
  const [stage, setStage] = useState('')
  const [description, setDescription] = useState('')
  const [revision, setRevision] = useState('Rev 1')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  async function handleUpload(file: File) {
    if (!file) return
    setUploading(true); setError(''); setSuccess('')

    // Step 1 — store file in Supabase storage
    setStage(STAGES[0])
    const path = `itps/${projectId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`
    const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: false })
    if (upErr) { setError(upErr.message); setUploading(false); setStage(''); return }

    // Step 2 — save record to project_itps
    const { data, error: dbErr } = await supabase
      .from('project_itps')
      .insert({ project_id: projectId, file_name: file.name, storage_path: path, file_size: file.size, description: description.trim() || null })
      .select().single()
    if (dbErr) { setError(dbErr.message); setUploading(false); setStage(''); return }
    setItps(prev => [data as ITP, ...prev])

    // Step 3 — trigger AI civils analysis if a construction site exists
    if (siteId) {
      setStage(STAGES[1])
      try {
        const form = new FormData()
        form.set('file', file)
        form.set('revision', revision.trim() || 'Rev 1')
        setStage(STAGES[2])
        const res = await fetch(`/api/construction/${siteId}/itp`, { method: 'POST', body: form })
        setStage(STAGES[3])
        const result = await res.json()
        if (!res.ok) throw new Error(result.error ?? 'Analysis failed')
        const parts = [
          result.isBaseline ? 'Baseline set' : `${result.revision} analysed`,
          result.activitiesSeeded > 0 ? `${result.activitiesSeeded} civils activities created` : null,
          result.activitiesCompleted > 0 ? `${result.activitiesCompleted} marked complete` : null,
        ].filter(Boolean)
        setSuccess(parts.join(' · ') || 'ITP analysed — no new civils activities found')
      } catch (e: unknown) {
        setError(`Saved but AI analysis failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    } else {
      setSuccess('ITP saved. Link a construction site to enable AI civils seeding.')
    }

    setDescription(''); setRevision('Rev 1'); setShowForm(false)
    setUploading(false); setStage('')
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
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ClipboardList size={15} style={{ color: 'var(--accent)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Inspection &amp; Test Plan (ITP)
          </h3>
          {itps.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
              {itps.length}
            </span>
          )}
          {siteId && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}>
              <Zap size={9} /> AI civils seeding enabled
            </span>
          )}
        </div>
        {canEdit && (
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border hover:opacity-80 transition-opacity"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <Upload size={11} /> Upload ITP
          </button>
        )}
      </div>

      {showForm && canEdit && (
        <div className="rounded-lg border p-4 mb-4 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Description (optional)</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Civils ITP Rev 2 — Braco BESS"
                className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            </div>
            {siteId && (
              <div className="min-w-[110px]">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Revision</label>
                <input type="text" value={revision} onChange={e => setRevision(e.target.value)}
                  placeholder="Rev 1"
                  className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
            )}
          </div>
          <button onClick={() => inputRef.current?.click()} disabled={uploading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed text-sm hover:opacity-80 disabled:opacity-50 transition-opacity"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
            {uploading
              ? <><Loader2 size={13} className="animate-spin" />{stage}</>
              : <><Upload size={13} />Choose file (PDF, Excel, XLSB, DOCX)</>}
          </button>
          {uploading && (
            <div className="space-y-1.5">
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full animate-pulse" style={{ width: '100%', background: 'var(--accent)', opacity: 0.7 }} />
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{stage}</p>
            </div>
          )}
          {error && <p className="text-xs" style={{ color: 'var(--critical)' }}>{error}</p>}
          {success && (
            <p className="flex items-center gap-1.5 text-xs" style={{ color: '#22c55e' }}>
              <CheckCircle2 size={13} /> {success}
            </p>
          )}
          <input ref={inputRef} type="file" accept="*/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); if (inputRef.current) inputRef.current.value = '' }} />
        </div>
      )}

      {success && !showForm && (
        <p className="flex items-center gap-1.5 text-xs mb-3" style={{ color: '#22c55e' }}>
          <CheckCircle2 size={13} /> {success}
        </p>
      )}

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
            <div key={itp.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 border"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
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
                <button onClick={() => handleDownload(itp)} title="Download" className="hover:opacity-80" style={{ color: 'var(--accent)' }}>
                  <Download size={13} />
                </button>
                {canEdit && (
                  <button onClick={() => handleDelete(itp)} title="Remove" className="hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
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
