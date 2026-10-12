'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Upload, FileText, Loader2, ClipboardList, CheckCircle2,
  ChevronDown, ChevronRight, Star, Plus, Minus, GitBranch, Calendar,
} from 'lucide-react'

interface ItpRevision {
  id: string
  revision: string
  file_name: string
  is_baseline: boolean
  uploaded_at: string
  analysed_at: string | null
  diff_summary: { added: string[]; removed: string[]; completed: string[]; changed: string[] } | null
  ai_activities: any[] | null
}

interface Props {
  siteId: string
  canEdit: boolean
}

export default function ItpPanel({ siteId, canEdit }: Props) {
  const [revisions, setRevisions] = useState<ItpRevision[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [stage, setStage] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [revLabel, setRevLabel] = useState('Rev 1')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [seedingP6, setSeedingP6] = useState(false)
  const [p6Result, setP6Result] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/construction/${siteId}/itp`)
      .then(r => r.json())
      .then(data => setRevisions(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [siteId])

  async function uploadItp(file: File) {
    setUploading(true); setError(''); setSuccess(''); setStage('Uploading file…')
    const form = new FormData()
    form.set('file', file)
    form.set('revision', revLabel.trim() || 'Rev 1')
    try {
      setStage('Extracting ITP content…')
      const res = await fetch(`/api/construction/${siteId}/itp`, { method: 'POST', body: form })
      setStage('AI analysing scope…')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      setStage('Seeding activity register…')
      const parts = [
        data.isBaseline ? 'Baseline set' : `${data.revision} analysed`,
        data.activitiesSeeded   > 0 ? `${data.activitiesSeeded} activities created`  : null,
        data.activitiesCompleted > 0 ? `${data.activitiesCompleted} marked complete` : null,
        data.activitiesUpdated  > 0 ? `${data.activitiesUpdated} updated`             : null,
      ].filter(Boolean)
      setSuccess(parts.join(' · ') || 'ITP analysed')
      const revRes = await fetch(`/api/construction/${siteId}/itp`)
      if (revRes.ok) setRevisions(await revRes.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false); setStage('')
    }
  }

  async function seedFromP6() {
    setSeedingP6(true); setP6Result('')
    try {
      const res = await fetch(`/api/construction/${siteId}/seed-from-p6`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Seeding failed')
      setP6Result(`${data.seeded} activities seeded from ${data.source}`)
    } catch (e: unknown) {
      setP6Result(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSeedingP6(false)
    }
  }

  const hasBaseline = revisions.some(r => r.is_baseline)

  return (
    <div className="p-4 space-y-4">
      {/* Upload form */}
      {canEdit && (
        <div className="rounded-xl border p-4 space-y-3"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
          <div className="flex items-center gap-2">
            <ClipboardList size={15} style={{ color: 'var(--accent)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {hasBaseline ? 'Upload revised ITP' : 'Upload ITP'}
            </span>
            {!hasBaseline && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c' }}>
                No baseline set
              </span>
            )}
            {hasBaseline && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
                <Star size={10} /> Baseline set
              </span>
            )}
          </div>

          <div className="flex gap-3 flex-wrap items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                Revision label
              </label>
              <input type="text" value={revLabel} onChange={e => setRevLabel(e.target.value)}
                placeholder="e.g. Rev 1, Rev A"
                className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-opacity"
              style={{ background: 'var(--accent)' }}>
              {uploading
                ? <><Loader2 size={14} className="animate-spin" />{stage || 'Processing…'}</>
                : <><Upload size={14} />Upload ITP</>}
            </button>
            <input ref={fileRef} type="file" accept="*/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadItp(f); if (fileRef.current) fileRef.current.value = '' }} />
          </div>

          {uploading && (
            <div className="space-y-1.5">
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full animate-pulse" style={{ width: '100%', background: 'var(--accent)', opacity: 0.7 }} />
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{stage}</p>
            </div>
          )}
          {error   && <p className="text-xs" style={{ color: 'var(--critical)' }}>{error}</p>}
          {success && <p className="flex items-center gap-1.5 text-xs" style={{ color: '#22c55e' }}><CheckCircle2 size={13} />{success}</p>}
        </div>
      )}

      {/* Revision history */}
      {loading && (
        <div className="flex items-center justify-center py-8 gap-2" style={{ color: 'var(--text-muted)' }}>
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Loading revisions…</span>
        </div>
      )}

      {!loading && revisions.length === 0 && (
        <div className="text-center py-6 space-y-3">
          <ClipboardList size={28} className="mx-auto opacity-20" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No ITP uploaded yet.</p>
          {canEdit && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                No ITP available? Seed the activity register from the uploaded P6 programme instead.
              </p>
              <button onClick={seedFromP6} disabled={seedingP6}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border disabled:opacity-50 transition-opacity hover:opacity-80"
                style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                {seedingP6
                  ? <><Loader2 size={14} className="animate-spin" />Extracting from P6…</>
                  : <><Calendar size={14} />Seed from P6 programme</>}
              </button>
              {p6Result && (
                <p className="text-xs flex items-center gap-1.5"
                  style={{ color: p6Result.includes('activities') ? '#22c55e' : 'var(--critical)' }}>
                  {p6Result.includes('activities') && <CheckCircle2 size={12} />}
                  {p6Result}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {revisions.length > 0 && (
        <div className="space-y-2">
          {revisions.map(rev => {
            const isExpanded = expanded === rev.id
            const diff = rev.diff_summary
            const actCount = rev.ai_activities?.length ?? 0
            return (
              <div key={rev.id} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                <button onClick={() => setExpanded(isExpanded ? null : rev.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:opacity-80 transition-opacity"
                  style={{ background: 'var(--bg-elevated)' }}>
                  <div className="flex items-center gap-2.5">
                    {isExpanded
                      ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
                      : <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
                    <FileText size={14} style={{ color: 'var(--accent)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{rev.revision}</span>
                    {rev.is_baseline && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
                        <Star size={9} /> Baseline
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>{actCount} activities</span>
                    <span>{new Date(rev.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-xs pt-3" style={{ color: 'var(--text-muted)' }}>
                      File: {rev.file_name}
                      {rev.analysed_at && ` · Analysed ${new Date(rev.analysed_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                    </p>

                    {!rev.is_baseline && diff && (
                      <div className="grid grid-cols-2 gap-2">
                        {diff.completed?.length > 0 && (
                          <div className="rounded-lg p-3 space-y-1" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                            <p className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#22c55e' }}>
                              <CheckCircle2 size={11} /> {diff.completed.length} completed
                            </p>
                            {diff.completed.map((n: string) => <p key={n} className="text-xs pl-4" style={{ color: 'var(--text-muted)' }}>• {n}</p>)}
                          </div>
                        )}
                        {diff.added?.length > 0 && (
                          <div className="rounded-lg p-3 space-y-1" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                            <p className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#818cf8' }}>
                              <Plus size={11} /> {diff.added.length} added
                            </p>
                            {diff.added.map((n: string) => <p key={n} className="text-xs pl-4" style={{ color: 'var(--text-muted)' }}>• {n}</p>)}
                          </div>
                        )}
                        {diff.removed?.length > 0 && (
                          <div className="rounded-lg p-3 space-y-1" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                            <p className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#f87171' }}>
                              <Minus size={11} /> {diff.removed.length} removed
                            </p>
                            {diff.removed.map((n: string) => <p key={n} className="text-xs pl-4" style={{ color: 'var(--text-muted)' }}>• {n}</p>)}
                          </div>
                        )}
                        {diff.changed?.length > 0 && (
                          <div className="rounded-lg p-3 space-y-1" style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)' }}>
                            <p className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#fb923c' }}>
                              <GitBranch size={11} /> {diff.changed.length} changed
                            </p>
                            {diff.changed.map((n: string) => <p key={n} className="text-xs pl-4" style={{ color: 'var(--text-muted)' }}>• {n}</p>)}
                          </div>
                        )}
                        {(!diff.completed?.length && !diff.added?.length && !diff.removed?.length && !diff.changed?.length) && (
                          <p className="text-xs col-span-2" style={{ color: 'var(--text-muted)' }}>No structural changes vs baseline.</p>
                        )}
                      </div>
                    )}

                    {rev.is_baseline && rev.ai_activities && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Activities seeded from baseline:</p>
                        {rev.ai_activities.map((a: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-xs py-1 border-b" style={{ borderColor: 'var(--border)' }}>
                            <span style={{ color: 'var(--text-primary)' }}>{a.activity_group}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}>
                                {a.discipline ?? 'Civils'}
                              </span>
                              {a.is_complete && <CheckCircle2 size={11} style={{ color: '#22c55e' }} />}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
