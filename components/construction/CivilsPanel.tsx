'use client'

import { useState, useRef, useEffect } from 'react'
import {
  HardHat, Upload, FileText, ChevronDown, ChevronRight,
  AlertTriangle, CheckCircle2, Clock, Loader2, BookOpen,
  CalendarDays, Users, Zap, RefreshCw, ClipboardList,
  Plus, Minus, GitBranch, Star,
} from 'lucide-react'

export interface CivilsActivity {
  id: string
  activity_group: string
  description: string
  discipline: 'Civils' | 'Electrical' | 'HV' | 'Commissioning'  // HV is an EME sub-type, treated as Electrical
  category: 'Below Ground' | 'Above Ground' | 'N/A'
  itp_ref: string | null
  status: 'Not Started' | 'In Progress' | 'Complete' | 'Blocked'
  progress_pct: number
  progress_note: string | null
  last_diary_update: string | null
  is_blocker: boolean
  blocks_package: string[] | null
  sort_order: number
}

export interface SiteDiary {
  id: string
  diary_date: string
  file_name: string | null
  ai_summary: string | null
  ai_weather: string | null
  ai_crew_count: number | null
  ai_analysed_at: string | null
  uploaded_at: string
}

interface Props {
  siteId: string
  initialActivities: CivilsActivity[]
  initialDiaries: SiteDiary[]
  canEdit: boolean
}

const STATUS_STYLE: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  'Complete':    { bg: 'rgba(34,197,94,0.12)',  text: '#22c55e', icon: <CheckCircle2 size={11} /> },
  'In Progress': { bg: 'rgba(251,146,60,0.12)', text: '#fb923c', icon: <Clock size={11} /> },
  'Blocked':     { bg: 'rgba(248,113,113,0.12)',text: '#f87171', icon: <AlertTriangle size={11} /> },
  'Not Started': { bg: 'rgba(148,163,184,0.12)',text: '#94a3b8', icon: <Clock size={11} /> },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE['Not Started']
  return (
    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: s.bg, color: s.text }}>
      {s.icon} {status}
    </span>
  )
}

function ProgressBar({ pct, status }: { pct: number; status: string }) {
  const color = status === 'Complete' ? '#22c55e'
    : status === 'Blocked' ? '#f87171'
    : status === 'In Progress' ? '#fb923c'
    : '#94a3b8'
  return (
    <div className="h-1.5 rounded-full w-full overflow-hidden" style={{ background: 'var(--border)' }}>
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

function VelocityDot({ lastUpdate, status }: { lastUpdate: string | null; status: string }) {
  if (status === 'Complete') return null
  if (!lastUpdate) {
    return (
      <span className="flex items-center gap-1 text-xs shrink-0" style={{ color: 'var(--text-muted)' }}
        title="No diary entries yet">
        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#94a3b8' }} />
        No updates
      </span>
    )
  }
  const days = Math.floor((Date.now() - new Date(lastUpdate).getTime()) / 86400000)
  const color = days <= 7 ? '#22c55e' : days <= 14 ? '#fb923c' : '#f87171'
  const label = days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days}d ago`
  const pulse = days <= 7
  return (
    <span className="flex items-center gap-1 text-xs shrink-0" style={{ color }} title={`Last diary update ${label}`}>
      <span className={`w-1.5 h-1.5 rounded-full inline-block${pulse ? ' animate-pulse' : ''}`}
        style={{ background: color }} />
      {label}
    </span>
  )
}

function ActivityRow({ act }: { act: CivilsActivity }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <button
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:opacity-80 transition-opacity"
        style={{ background: 'var(--bg-elevated)' }}
        onClick={() => setExpanded(v => !v)}
      >
        {expanded ? <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} />
          : <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {act.activity_group}
            </span>
            {act.is_blocker && act.status !== 'Complete' && (
              <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
                Gates {(act.blocks_package ?? []).join(', ')}
              </span>
            )}
          </div>
          <ProgressBar pct={act.progress_pct} status={act.status} />
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-3">
          <VelocityDot lastUpdate={act.last_diary_update} status={act.status} />
          <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {act.progress_pct}%
          </span>
          <StatusBadge status={act.status} />
        </div>
      </button>

      {expanded && (
        <div className="px-4 py-3 border-t text-sm space-y-1.5"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <p style={{ color: 'var(--text-muted)' }}>{act.description}</p>
          {act.progress_note && (
            <p className="text-xs italic" style={{ color: 'var(--text-secondary)' }}>
              Latest update: {act.progress_note}
            </p>
          )}
          {act.last_diary_update && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Last diary update: {new Date(act.last_diary_update).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric'
              })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function DiaryCard({ diary }: { diary: SiteDiary }) {
  return (
    <div className="rounded-lg border px-3 py-2.5 space-y-1"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
      <div className="flex items-center gap-2">
        <CalendarDays size={12} style={{ color: 'var(--accent)' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {new Date(diary.diary_date).toLocaleDateString('en-GB', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
          })}
        </span>
        {diary.ai_crew_count && (
          <span className="flex items-center gap-1 text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
            <Users size={11} /> {diary.ai_crew_count} crew
          </span>
        )}
        {diary.ai_weather && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{diary.ai_weather}</span>
        )}
      </div>
      {diary.ai_summary && (
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {diary.ai_summary}
        </p>
      )}
      {diary.file_name && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          <FileText size={10} className="inline mr-1" />{diary.file_name}
        </p>
      )}
    </div>
  )
}

interface ItpRevision {
  id: string; revision: string; file_name: string; is_baseline: boolean
  uploaded_at: string; analysed_at: string | null
  diff_summary: { added: string[]; removed: string[]; completed: string[]; changed: string[] } | null
  ai_activities: any[] | null
}

export default function CivilsPanel({ siteId, initialActivities, initialDiaries, canEdit }: Props) {
  const [activities, setActivities] = useState(initialActivities)
  const [diaries, setDiaries] = useState(initialDiaries)
  const [tab, setTab] = useState<'register' | 'diaries' | 'itp'>('register')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [diaryDate, setDiaryDate] = useState(new Date().toISOString().split('T')[0])
  const [rawText, setRawText] = useState('')
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text')
  const fileRef = useRef<HTMLInputElement>(null)

  // ITP state
  const [itpRevisions, setItpRevisions] = useState<ItpRevision[]>([])
  const [itpLoading, setItpLoading] = useState(false)
  const [itpUploading, setItpUploading] = useState(false)
  const [itpStage, setItpStage] = useState('')
  const [itpError, setItpError] = useState('')
  const [itpSuccess, setItpSuccess] = useState('')
  const [itpRevLabel, setItpRevLabel] = useState('Rev 1')
  const [expandedRev, setExpandedRev] = useState<string | null>(null)
  const itpFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (tab === 'itp' && itpRevisions.length === 0) {
      setItpLoading(true)
      fetch(`/api/construction/${siteId}/itp`)
        .then(r => r.json())
        .then(data => { setItpRevisions(Array.isArray(data) ? data : []); setItpLoading(false) })
        .catch(() => setItpLoading(false))
    }
  }, [tab, siteId])

  async function uploadItp(file: File) {
    setItpUploading(true); setItpError(''); setItpSuccess(''); setItpStage('Uploading file…')
    const form = new FormData()
    form.set('file', file)
    form.set('revision', itpRevLabel.trim() || 'Rev 1')
    try {
      setItpStage('Extracting ITP content…')
      const res = await fetch(`/api/construction/${siteId}/itp`, { method: 'POST', body: form })
      setItpStage('AI analysing civils scope…')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      setItpStage('Seeding activity register…')

      const parts = [
        data.isBaseline ? 'Baseline set' : `${data.revision} analysed`,
        data.activitiesSeeded > 0 ? `${data.activitiesSeeded} activities created` : null,
        data.activitiesCompleted > 0 ? `${data.activitiesCompleted} marked complete` : null,
        data.activitiesUpdated > 0 ? `${data.activitiesUpdated} updated` : null,
      ].filter(Boolean)
      setItpSuccess(parts.join(' · '))

      // Re-fetch revisions + activities
      const [revRes, actRes] = await Promise.all([
        fetch(`/api/construction/${siteId}/itp`),
        fetch(`/api/construction/${siteId}/civils/activities`),
      ])
      if (revRes.ok) setItpRevisions(await revRes.json())
      if (actRes.ok) { const { activities: acts } = await actRes.json(); setActivities(acts) }
    } catch (e: unknown) {
      setItpError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setItpUploading(false); setItpStage('')
    }
  }

  const civils      = activities.filter(a => (a.discipline ?? 'Civils') === 'Civils')
  // HV is an EME sub-type — grouped under Electrical
  const electrical  = activities.filter(a => a.discipline === 'Electrical' || a.discipline === 'HV')
  const commissioning = activities.filter(a => a.discipline === 'Commissioning')
  const belowGround = civils.filter(a => a.category === 'Below Ground')
  const aboveGround = civils.filter(a => a.category !== 'Below Ground')

  function avgProgress(acts: CivilsActivity[]) {
    if (!acts.length) return 0
    return Math.round(acts.reduce((s, a) => s + a.progress_pct, 0) / acts.length)
  }

  const completeCount = activities.filter(a => a.status === 'Complete').length
  const blockerCount = activities.filter(a => a.is_blocker && a.status !== 'Complete').length
  const wipCount = activities.filter(a => a.status === 'In Progress').length

  async function submitDiary(file?: File) {
    setUploading(true)
    setError('')
    setSuccess('')

    const form = new FormData()
    form.set('diary_date', diaryDate)
    if (file) {
      form.set('file', file)
    } else {
      form.set('raw_text', rawText)
    }

    try {
      const res = await fetch(`/api/construction/${siteId}/civils/diary`, {
        method: 'POST',
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')

      setSuccess(`Diary processed. ${data.updatedActivities} activities updated.`)
      setRawText('')

      // Re-fetch activities to get updated progress
      const updated = await fetch(`/api/construction/${siteId}/civils/activities`)
      if (updated.ok) {
        const { activities: acts } = await updated.json()
        setActivities(acts)
      }
      if (data.diary) {
        setDiaries(prev => [data.diary, ...prev])
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error processing diary')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <HardHat size={16} style={{ color: 'var(--accent)' }} />
        <div className="flex-1">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Civils Works</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Below & above ground civil construction — progress from site diaries
          </p>
        </div>
        {/* KPI chips */}
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded-full"
            style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
            {completeCount}/{activities.length} complete
          </span>
          {wipCount > 0 && (
            <span className="text-xs px-2 py-1 rounded-full"
              style={{ background: 'rgba(251,146,60,0.12)', color: '#fb923c' }}>
              {wipCount} WIP
            </span>
          )}
          {blockerCount > 0 && (
            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
              style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
              <AlertTriangle size={10} /> {blockerCount} blocker{blockerCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Progress overview */}
      <div className="grid grid-cols-2 gap-px border-b" style={{ borderColor: 'var(--border)', background: 'var(--border)' }}>
        {[
          { label: 'Below Ground', acts: belowGround },
          { label: 'Above Ground', acts: aboveGround },
          ...(electrical.length > 0 ? [{ label: 'Electrical (EME)', acts: electrical }] : []),
          ...(commissioning.length > 0 ? [{ label: 'Commissioning', acts: commissioning }] : []),
        ].map(({ label, acts }) => {
          const pct = avgProgress(acts)
          const done = acts.filter(a => a.status === 'Complete').length
          return (
            <div key={label} className="px-4 py-3 space-y-2" style={{ background: 'var(--surface-raised)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span className="text-xs tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {done}/{acts.length}
                </span>
              </div>
              <ProgressBar pct={pct} status={pct === 100 ? 'Complete' : pct > 0 ? 'In Progress' : 'Not Started'} />
              <span className="text-lg font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {pct}%
              </span>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
        {([
          { key: 'register', label: 'Activity Register' },
          { key: 'diaries',  label: `Site Diaries${diaries.length ? ` (${diaries.length})` : ''}` },
          { key: 'itp',      label: `ITP${itpRevisions.length ? ` (${itpRevisions.length})` : ''}` },
        ] as { key: 'register' | 'diaries' | 'itp'; label: string }[]).map(({ key, label }) => (
          <button key={key}
            onClick={() => setTab(key)}
            className="px-4 py-2.5 text-xs font-medium border-b-2 transition-colors"
            style={{
              borderBottomColor: tab === key ? 'var(--accent)' : 'transparent',
              color: tab === key ? 'var(--accent)' : 'var(--text-muted)',
            }}>
            {label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {tab === 'register' && (
          <>
            {activities.length === 0 && (
              <div className="text-center py-8">
                <HardHat size={28} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  No civils activities seeded yet.
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Run migration 028 in Supabase to load the Dyce activity register.
                </p>
              </div>
            )}

            {[
              { label: 'Civils — Below Ground (ECV)', acts: belowGround },
              { label: 'Civils — Above Ground (ECV)', acts: aboveGround },
              { label: 'Electrical (EME)', acts: electrical },
              { label: 'Commissioning', acts: commissioning },
            ].filter(s => s.acts.length > 0).map(({ label, acts }) => (
              <div key={label} className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide px-1 mt-2"
                  style={{ color: 'var(--text-muted)' }}>{label}</h4>
                {acts.map(a => <ActivityRow key={a.id} act={a} />)}
              </div>
            ))}
          </>
        )}

        {tab === 'itp' && (
          <div className="space-y-4">
            {canEdit && (
              <div className="rounded-xl border p-4 space-y-3"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
                <div className="flex items-center gap-2">
                  <ClipboardList size={15} style={{ color: 'var(--accent)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    Upload ITP
                  </span>
                  {itpRevisions.length === 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c' }}>
                      No baseline set
                    </span>
                  )}
                  {itpRevisions.some(r => r.is_baseline) && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
                      <Star size={10} /> Baseline set
                    </span>
                  )}
                </div>

                <div className="flex gap-3 flex-wrap">
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                      Revision label
                    </label>
                    <input
                      type="text"
                      value={itpRevLabel}
                      onChange={e => setItpRevLabel(e.target.value)}
                      placeholder="e.g. Rev 1, Rev A"
                      className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => itpFileRef.current?.click()}
                      disabled={itpUploading}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-opacity"
                      style={{ background: 'var(--accent)' }}>
                      {itpUploading
                        ? <><Loader2 size={14} className="animate-spin" />{itpStage || 'Processing…'}</>
                        : <><Upload size={14} />Upload ITP</>}
                    </button>
                    <input ref={itpFileRef} type="file" accept="*/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadItp(f); if (itpFileRef.current) itpFileRef.current.value = '' }} />
                  </div>
                </div>

                {itpUploading && (
                  <div className="space-y-1.5">
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                      <div className="h-full rounded-full animate-pulse" style={{ width: '100%', background: 'var(--accent)', opacity: 0.7 }} />
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{itpStage}</p>
                  </div>
                )}
                {itpError && <p className="text-xs" style={{ color: 'var(--critical)' }}>{itpError}</p>}
                {itpSuccess && (
                  <p className="flex items-center gap-1.5 text-xs" style={{ color: '#22c55e' }}>
                    <CheckCircle2 size={13} /> {itpSuccess}
                  </p>
                )}
              </div>
            )}

            {itpLoading && (
              <div className="flex items-center justify-center py-8 gap-2" style={{ color: 'var(--text-muted)' }}>
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Loading revisions…</span>
              </div>
            )}

            {!itpLoading && itpRevisions.length === 0 && (
              <div className="text-center py-8">
                <ClipboardList size={28} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No ITP uploaded yet.</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Upload the project ITP to auto-populate the civils activity register.
                </p>
              </div>
            )}

            {itpRevisions.length > 0 && (
              <div className="space-y-2">
                {itpRevisions.map(rev => {
                  const isExpanded = expandedRev === rev.id
                  const diff = rev.diff_summary
                  const actCount = rev.ai_activities?.length ?? 0
                  return (
                    <div key={rev.id} className="rounded-xl border overflow-hidden"
                      style={{ borderColor: 'var(--border)' }}>
                      <button
                        onClick={() => setExpandedRev(isExpanded ? null : rev.id)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:opacity-80 transition-opacity"
                        style={{ background: 'var(--bg-elevated)' }}>
                        <div className="flex items-center gap-2.5">
                          {isExpanded ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
                            : <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
                          <FileText size={14} style={{ color: 'var(--accent)' }} />
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {rev.revision}
                          </span>
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
                                <div className="rounded-lg p-3 space-y-1"
                                  style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                                  <p className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#22c55e' }}>
                                    <CheckCircle2 size={11} /> {diff.completed.length} completed
                                  </p>
                                  {diff.completed.map((n: string) => (
                                    <p key={n} className="text-xs pl-4" style={{ color: 'var(--text-muted)' }}>• {n}</p>
                                  ))}
                                </div>
                              )}
                              {diff.added?.length > 0 && (
                                <div className="rounded-lg p-3 space-y-1"
                                  style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                                  <p className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#818cf8' }}>
                                    <Plus size={11} /> {diff.added.length} added
                                  </p>
                                  {diff.added.map((n: string) => (
                                    <p key={n} className="text-xs pl-4" style={{ color: 'var(--text-muted)' }}>• {n}</p>
                                  ))}
                                </div>
                              )}
                              {diff.removed?.length > 0 && (
                                <div className="rounded-lg p-3 space-y-1"
                                  style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                                  <p className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#f87171' }}>
                                    <Minus size={11} /> {diff.removed.length} removed
                                  </p>
                                  {diff.removed.map((n: string) => (
                                    <p key={n} className="text-xs pl-4" style={{ color: 'var(--text-muted)' }}>• {n}</p>
                                  ))}
                                </div>
                              )}
                              {diff.changed?.length > 0 && (
                                <div className="rounded-lg p-3 space-y-1"
                                  style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)' }}>
                                  <p className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#fb923c' }}>
                                    <GitBranch size={11} /> {diff.changed.length} changed
                                  </p>
                                  {diff.changed.map((n: string) => (
                                    <p key={n} className="text-xs pl-4" style={{ color: 'var(--text-muted)' }}>• {n}</p>
                                  ))}
                                </div>
                              )}
                              {(!diff.completed?.length && !diff.added?.length && !diff.removed?.length && !diff.changed?.length) && (
                                <p className="text-xs col-span-2" style={{ color: 'var(--text-muted)' }}>No structural changes vs baseline.</p>
                              )}
                            </div>
                          )}

                          {rev.is_baseline && rev.ai_activities && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                                Activities seeded from baseline:
                              </p>
                              {rev.ai_activities.map((a: any, i: number) => (
                                <div key={i} className="flex items-center justify-between text-xs py-1 border-b"
                                  style={{ borderColor: 'var(--border)' }}>
                                  <span style={{ color: 'var(--text-primary)' }}>{a.activity_group}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs px-1.5 py-0.5 rounded"
                                      style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}>
                                      {a.category}
                                    </span>
                                    {a.is_complete && (
                                      <CheckCircle2 size={11} style={{ color: '#22c55e' }} />
                                    )}
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
        )}

        {tab === 'diaries' && (
          <div className="space-y-4">
            {canEdit && (
              <div className="rounded-xl border p-4 space-y-3"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    Add Site Diary
                  </span>
                  <div className="flex items-center gap-1 rounded-lg border p-0.5"
                    style={{ borderColor: 'var(--border)' }}>
                    {(['text', 'file'] as const).map(m => (
                      <button key={m}
                        onClick={() => setInputMode(m)}
                        className="px-2.5 py-1 rounded text-xs font-medium transition-colors"
                        style={{
                          background: inputMode === m ? 'var(--accent)' : 'transparent',
                          color: inputMode === m ? '#fff' : 'var(--text-muted)',
                        }}>
                        {m === 'text' ? 'Paste text' : 'Upload file'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                    Diary date
                  </label>
                  <input type="date" value={diaryDate}
                    onChange={e => setDiaryDate(e.target.value)}
                    className="rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>

                {inputMode === 'text' ? (
                  <>
                    <textarea
                      value={rawText}
                      onChange={e => setRawText(e.target.value)}
                      rows={5}
                      placeholder="Paste or type the site diary content here. Include activities worked on, crew numbers, any issues or delays, weather conditions..."
                      className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
                      style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    />
                    <button
                      onClick={() => submitDiary()}
                      disabled={uploading || !rawText.trim()}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-opacity"
                      style={{ background: 'var(--accent)' }}>
                      {uploading ? <><Loader2 size={14} className="animate-spin" />Processing…</>
                        : <><Zap size={14} />Analyse with AI</>}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed text-sm hover:opacity-80 disabled:opacity-50"
                      style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                      {uploading
                        ? <><Loader2 size={14} className="animate-spin" />Processing…</>
                        : <><Upload size={14} />Choose PDF or text file</>}
                    </button>
                    <input ref={fileRef} type="file" accept=".pdf,.txt,.doc,.docx" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) submitDiary(f) }} />
                  </>
                )}

                {error && <p className="text-xs" style={{ color: 'var(--critical)' }}>{error}</p>}
                {success && (
                  <p className="flex items-center gap-1.5 text-xs" style={{ color: '#22c55e' }}>
                    <CheckCircle2 size={13} /> {success}
                  </p>
                )}
              </div>
            )}

            {diaries.length === 0 && (
              <div className="text-center py-8">
                <BookOpen size={28} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No site diaries uploaded yet.</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Upload or paste a daily diary to let AI interpret civils progress.
                </p>
              </div>
            )}

            {diaries.length > 0 && (
              <div className="space-y-2">
                {diaries.map(d => <DiaryCard key={d.id} diary={d} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
