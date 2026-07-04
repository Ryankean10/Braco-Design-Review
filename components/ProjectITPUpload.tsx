'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { Upload, FileText, Download, Trash2, Loader2, ClipboardList, CheckCircle2, Zap, Lock, ArrowRight, AlertTriangle, ShieldAlert } from 'lucide-react'
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
  userRole?: string
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

export default function ProjectITPUpload({ projectId, siteId, initialItps, canEdit, userRole }: Props) {
  const [itps, setItps] = useState<ITP[]>(initialItps)
  const [uploading, setUploading] = useState(false)
  const [stage, setStage] = useState('')
  const [description, setDescription] = useState('')
  const [revision, setRevision] = useState('Rev 1')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const isAdmin = userRole === 'admin'
  const baselineLocked = itps.length > 0

  async function handleUpload(file: File) {
    if (!file) return
    setUploading(true); setError(''); setSuccess('')
    setShowOverrideConfirm(false)

    // Step 1 — store file in Supabase storage
    setStage(STAGES[0])
    const path = `itps/${projectId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`
    const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: false })
    if (upErr) { setError(upErr.message); setUploading(false); setStage(''); return }

    // Step 2 — save record to project_itps
    // Override reason is stored in description prefixed with [ADMIN OVERRIDE] for audit trail
    const descValue = overrideReason.trim()
      ? `[ADMIN OVERRIDE] ${overrideReason.trim()}${description.trim() ? ' — ' + description.trim() : ''}`
      : description.trim() || null
    const { data, error: dbErr } = await supabase
      .from('project_itps')
      .insert({ project_id: projectId, file_name: file.name, storage_path: path, file_size: file.size, description: descValue })
      .select().single()
    if (dbErr) { setError(dbErr.message); setUploading(false); setStage(''); return }
    setItps(prev => [data as ITP, ...prev])
    setOverrideReason('')

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
              <Zap size={9} /> AI seeding enabled
            </span>
          )}
        </div>
        {/* Upload button — visible before baseline locked, or for admin override */}
        {canEdit && !baselineLocked && (
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border hover:opacity-80 transition-opacity"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <Upload size={11} /> Upload ITP
          </button>
        )}
        {isAdmin && baselineLocked && (
          <button onClick={() => setShowOverrideConfirm(true)}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border hover:opacity-80 transition-opacity"
            style={{ borderColor: 'rgba(251,146,60,0.4)', color: '#fb923c' }}>
            <ShieldAlert size={11} /> Admin override
          </button>
        )}
      </div>

      {/* Upload form — visible before baseline locked, or after admin override confirmed */}
      {showForm && canEdit && !baselineLocked && (
        <div className="rounded-lg border p-4 mb-4 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Description (optional)</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Civils ITP Rev 1"
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

      {success && !showForm && itps.length === 0 && (
        <p className="flex items-center gap-1.5 text-xs mb-3" style={{ color: '#22c55e' }}>
          <CheckCircle2 size={13} /> {success}
        </p>
      )}

      {/* Admin override confirmation modal */}
      {showOverrideConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-xl border p-6 max-w-md w-full space-y-4"
            style={{ background: 'var(--surface-raised)', borderColor: 'rgba(251,146,60,0.4)' }}>
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="shrink-0 mt-0.5" style={{ color: '#fb923c' }} />
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Override baseline ITP?
                </h3>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  This will replace the locked baseline with a new upload. The existing file will be retained in the audit history below but the new upload will become the active baseline and re-seed the construction activity register.
                </p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Reason for override <span style={{ color: '#f87171' }}>*</span>
              </label>
              <textarea
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                rows={3}
                placeholder="e.g. Incorrect baseline uploaded — replacing with correct Rev 1 issued 04/07/2026"
                className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-orange-500/40 resize-none"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowOverrideConfirm(false); setOverrideReason('') }}
                className="px-3 py-1.5 text-xs rounded-lg border hover:opacity-80 transition-opacity"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                Cancel
              </button>
              <button
                disabled={!overrideReason.trim()}
                onClick={() => { setShowOverrideConfirm(false); setShowForm(true) }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium hover:opacity-80 disabled:opacity-40 transition-opacity"
                style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.4)' }}>
                <ShieldAlert size={11} /> Confirm override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Override upload form — shown after admin confirms */}
      {showForm && isAdmin && baselineLocked && (
        <div className="rounded-lg border p-4 mb-4 space-y-3"
          style={{ borderColor: 'rgba(251,146,60,0.35)', background: 'rgba(251,146,60,0.04)' }}>
          <div className="flex items-center gap-2">
            <ShieldAlert size={13} style={{ color: '#fb923c' }} />
            <p className="text-xs font-medium" style={{ color: '#fb923c' }}>Admin override — uploading new baseline</p>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Reason: <span style={{ color: 'var(--text-secondary)' }}>{overrideReason || '—'}</span>
          </p>
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Description (optional)</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Corrected baseline ITP Rev 1"
                className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            </div>
            {siteId && (
              <div className="min-w-[110px]">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Revision</label>
                <input type="text" value={revision} onChange={e => setRevision(e.target.value)} placeholder="Rev 1"
                  className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
            )}
          </div>
          <button onClick={() => inputRef.current?.click()} disabled={uploading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed text-sm hover:opacity-80 disabled:opacity-50 transition-opacity"
            style={{ borderColor: '#fb923c', color: '#fb923c' }}>
            {uploading
              ? <><Loader2 size={13} className="animate-spin" />{stage}</>
              : <><Upload size={13} />Choose replacement ITP file</>}
          </button>
          {uploading && (
            <div className="space-y-1.5">
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full animate-pulse" style={{ width: '100%', background: '#fb923c', opacity: 0.7 }} />
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{stage}</p>
            </div>
          )}
          {error && <p className="text-xs" style={{ color: 'var(--critical)' }}>{error}</p>}
          {success && <p className="flex items-center gap-1.5 text-xs" style={{ color: '#22c55e' }}><CheckCircle2 size={13} /> {success}</p>}
          <button onClick={() => { setShowForm(false); setOverrideReason('') }}
            className="text-xs hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
            Cancel
          </button>
          <input ref={inputRef} type="file" accept="*/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); if (inputRef.current) inputRef.current.value = '' }} />
        </div>
      )}

      {/* Baseline locked banner — shown once an ITP has been uploaded */}
      {itps.length > 0 && siteId && (
        <div className="flex items-start gap-3 rounded-lg px-3 py-2.5 mb-3"
          style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <Lock size={13} className="mt-0.5 shrink-0" style={{ color: '#22c55e' }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium" style={{ color: '#22c55e' }}>Baseline locked</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              The baseline ITP is set. Upload revised ITPs in the construction module to track changes against this baseline.
            </p>
          </div>
          <Link href={`/construction/${siteId}#itp`}
            className="flex items-center gap-1 text-xs font-medium shrink-0 hover:opacity-80 transition-opacity"
            style={{ color: 'var(--accent)' }}>
            Go to ITP <ArrowRight size={11} />
          </Link>
        </div>
      )}

      {itps.length > 0 && !siteId && (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 mb-3"
          style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <Lock size={12} style={{ color: '#22c55e' }} />
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Baseline locked. Link a construction site to manage revisions.
          </p>
        </div>
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
          {itps.map((itp, idx) => {
            const isOverride = itp.description?.startsWith('[ADMIN OVERRIDE]')
            const isSuperseded = idx > 0  // older uploads are superseded by the most recent
            const displayDesc = isOverride
              ? itp.description!.replace('[ADMIN OVERRIDE]', '').trim()
              : itp.description
            return (
              <div key={itp.id} className="rounded-lg border"
                style={{
                  borderColor: isOverride ? 'rgba(251,146,60,0.3)' : isSuperseded ? 'var(--border)' : 'var(--border)',
                  background: isSuperseded ? 'var(--bg-surface)' : 'var(--bg-elevated)',
                  opacity: isSuperseded ? 0.65 : 1,
                }}>
                {/* Superseded / override label */}
                {(isOverride || isSuperseded) && (
                  <div className="flex items-center gap-1.5 px-3 pt-2">
                    {isOverride && !isSuperseded && (
                      <span className="flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(251,146,60,0.12)', color: '#fb923c' }}>
                        <ShieldAlert size={9} /> Admin override
                      </span>
                    )}
                    {isSuperseded && (
                      <span className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
                        Superseded — retained for audit
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <FileText size={14} className="shrink-0"
                    style={{ color: isSuperseded ? 'var(--text-muted)' : 'var(--accent)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {displayDesc || itp.file_name}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {displayDesc ? itp.file_name + ' · ' : ''}
                      {fmtSize(itp.file_size)}
                      {' · '}
                      {new Date(itp.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => handleDownload(itp)} title="Download" className="hover:opacity-80"
                      style={{ color: 'var(--accent)' }}>
                      <Download size={13} />
                    </button>
                    {/* Only admins can delete, and only superseded entries (not the active baseline) */}
                    {isAdmin && isSuperseded && (
                      <button onClick={() => handleDelete(itp)} title="Remove from audit history"
                        className="hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
