'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  UsersRound, Plus, Search, X, ChevronDown, ChevronRight,
  Briefcase, HardHat, Star, Mail, Phone, Building2,
  Loader2, CheckCircle2, Trash2, Edit2, History, Calendar,
  ClipboardList, MapPin, Clock,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────
interface Person {
  id: string; name: string; role: string | null; discipline: string | null
  company: string | null; email: string | null; phone: string | null; notes: string | null
  person_group: string | null; is_active: boolean
}

const PERSON_GROUPS = [
  'Project Staff',
  'OCU Site Management',
  'OCU Electrical Staff',
  'OCU Civils Staff',
  'Agency Staff',
  'Subcontractors',
] as const
interface Appointment {
  id: string; person_id: string; project_id: string | null; site_id: string | null
  role_on_job: string | null; is_manager: boolean; start_date: string | null
  end_date: string | null; notes: string | null
  person: { id: string; name: string; role: string | null; discipline: string | null; company: string | null } | null
  project: { id: string; name: string; client: string | null } | null
  site: { id: string; name: string; client: string | null } | null
}
interface JobRef { id: string; name: string; client: string | null }

interface Props {
  people: Person[]; appointments: Appointment[]
  projects: JobRef[]; sites: JobRef[]
  currentUserId: string; canEdit: boolean
}

const DISCIPLINES = ['Electrical', 'Civils', 'Management', 'T&C', 'HSEQ', 'Other']
const DISC_COLOR: Record<string, { bg: string; text: string }> = {
  Electrical: { bg: 'rgba(59,130,246,0.12)',  text: '#60a5fa' },
  Civils:     { bg: 'rgba(251,146,60,0.12)',  text: '#fb923c' },
  Management: { bg: 'rgba(168,85,247,0.12)',  text: '#c084fc' },
  'T&C':      { bg: 'rgba(34,197,94,0.12)',   text: '#4ade80' },
  HSEQ:       { bg: 'rgba(248,113,113,0.12)', text: '#f87171' },
  Other:      { bg: 'rgba(148,163,184,0.12)', text: '#94a3b8' },
}

function DisciplineBadge({ d }: { d: string | null }) {
  const s = DISC_COLOR[d ?? ''] ?? DISC_COLOR.Other
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
      style={{ background: s.bg, color: s.text }}>{d ?? 'Other'}</span>
  )
}

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const colors = ['#6c72f5','#fb923c','#4ade80','#f87171','#c084fc','#60a5fa']
  const i = name.charCodeAt(0) % colors.length
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: colors[i],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.35, flexShrink: 0,
    }}>{initials(name)}</div>
  )
}

// ── Collapsible group section ─────────────────────────────────────────────────
function GroupSection({ title, count, appointed, children }: {
  title: string; count: number; appointed: number; children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  const notAppointed = count - appointed
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-3 w-full text-left px-4 py-3.5 hover:opacity-90 transition-opacity"
        style={{ background: 'var(--bg-elevated)' }}>
        <div className="flex-1 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            {count}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>
            {appointed} appointed
          </span>
          {notAppointed > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
              {notAppointed} not appointed
            </span>
          )}
        </div>
        {open
          ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
          : <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
      </button>
      {open && (
        <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ── Add/Edit Person modal ─────────────────────────────────────────────────────
function PersonModal({ person, onClose, onSaved }: {
  person?: Person; onClose: () => void; onSaved: (p: Person) => void
}) {
  const supabase = createClient()
  const [form, setForm] = useState({
    name: person?.name ?? '', role: person?.role ?? '', discipline: person?.discipline ?? '',
    company: person?.company ?? '', email: person?.email ?? '', phone: person?.phone ?? '',
    notes: person?.notes ?? '', person_group: person?.person_group ?? '',
    is_active: person?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    const payload = {
      name: form.name.trim(), role: form.role || null, discipline: form.discipline || null,
      company: form.company || null, email: form.email || null, phone: form.phone || null,
      notes: form.notes || null, person_group: form.person_group || null,
      is_active: form.is_active,
    }
    const q = person
      ? supabase.from('people').update(payload).eq('id', person.id).select().single()
      : supabase.from('people').insert(payload).select().single()
    const { data, error: err } = await q
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved(data as Person)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-md rounded-2xl border p-6 space-y-4"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {person ? 'Edit person' : 'Add to library'}
          </h3>
          <button onClick={onClose}><X size={16} style={{ color: 'var(--text-muted)' }} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'name', label: 'Full name *', span: true },
            { key: 'role', label: 'Job title', span: false },
            { key: 'company', label: 'Company', span: false },
            { key: 'email', label: 'Email', span: false },
            { key: 'phone', label: 'Phone', span: false },
          ].map(({ key, label, span }) => (
            <div key={key} className={span ? 'col-span-2' : ''}>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
              <input type="text" value={(form as any)[key]}
                onChange={e => set(key, e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
          ))}

          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Discipline</label>
            <div className="flex flex-wrap gap-2">
              {DISCIPLINES.map(d => (
                <button key={d} onClick={() => set('discipline', form.discipline === d ? '' : d)}
                  className="px-2.5 py-1 rounded-full text-xs border transition-all"
                  style={{
                    borderColor: form.discipline === d ? 'var(--accent)' : 'var(--border)',
                    background: form.discipline === d ? 'rgba(108,114,245,0.15)' : 'transparent',
                    color: form.discipline === d ? 'var(--accent)' : 'var(--text-muted)',
                  }}>{d}</button>
              ))}
            </div>
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Group</label>
            <div className="flex flex-wrap gap-2">
              {PERSON_GROUPS.map(g => (
                <button key={g} onClick={() => set('person_group', form.person_group === g ? '' : g)}
                  type="button"
                  className="px-2.5 py-1 rounded-full text-xs border transition-all"
                  style={{
                    borderColor: form.person_group === g ? 'var(--accent)' : 'var(--border)',
                    background: form.person_group === g ? 'rgba(108,114,245,0.15)' : 'transparent',
                    color: form.person_group === g ? 'var(--accent)' : 'var(--text-muted)',
                  }}>{g}</button>
              ))}
            </div>
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none resize-none"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>

        {error && <p className="text-xs" style={{ color: 'var(--critical)' }}>{error}</p>}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-xs border hover:opacity-80"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--accent)' }}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            {person ? 'Save changes' : 'Add person'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Appoint modal ─────────────────────────────────────────────────────────────
function AppointModal({ person, projects, sites, currentUserId, onClose, onSaved }: {
  person: Person; projects: JobRef[]; sites: JobRef[]
  currentUserId: string; onClose: () => void; onSaved: (a: Appointment) => void
}) {
  const supabase = createClient()
  const [jobType, setJobType] = useState<'project' | 'site'>('site')
  const [jobId, setJobId] = useState('')
  const [roleOnJob, setRoleOnJob] = useState(person.role ?? '')
  const [isManager, setIsManager] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!jobId) { setError('Select a project or site'); return }
    setSaving(true); setError('')
    const { data, error: err } = await supabase
      .from('job_appointments')
      .insert({
        person_id: person.id,
        appointed_by: currentUserId,
        project_id: jobType === 'project' ? jobId : null,
        site_id: jobType === 'site' ? jobId : null,
        role_on_job: roleOnJob || null,
        is_manager: isManager,
        start_date: startDate || null,
        end_date: endDate || null,
        notes: notes || null,
      })
      .select(`*, person:people(id,name,role,discipline,company), project:projects(id,name,client), site:construction_sites(id,name,client)`)
      .single()
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved(data as unknown as Appointment)
  }

  const jobs = jobType === 'project' ? projects : sites

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-md rounded-2xl border p-6 space-y-4"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Appoint to job
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{person.name}</p>
          </div>
          <button onClick={onClose}><X size={16} style={{ color: 'var(--text-muted)' }} /></button>
        </div>

        {/* Project vs Site toggle */}
        <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {(['site', 'project'] as const).map(t => (
            <button key={t} onClick={() => { setJobType(t); setJobId('') }}
              className="flex-1 py-2 text-xs font-medium capitalize transition-colors"
              style={{
                background: jobType === t ? 'var(--accent)' : 'transparent',
                color: jobType === t ? '#fff' : 'var(--text-muted)',
              }}>
              {t === 'site' ? 'Construction site' : 'Design project'}
            </button>
          ))}
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
            {jobType === 'site' ? 'Construction site' : 'Project'} *
          </label>
          <select value={jobId} onChange={e => setJobId(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none"
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
            <option value="">Select…</option>
            {jobs.map(j => (
              <option key={j.id} value={j.id}>{j.name}{j.client ? ` — ${j.client}` : ''}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Role on this job</label>
          <input type="text" value={roleOnJob} onChange={e => setRoleOnJob(e.target.value)}
            placeholder={person.role ?? 'e.g. Site Foreman'}
            className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none"
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          />
        </div>

        {/* Manager toggle */}
        <button onClick={() => setIsManager(v => !v)}
          className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2.5 border transition-all"
          style={{
            borderColor: isManager ? 'var(--accent)' : 'var(--border)',
            background: isManager ? 'rgba(108,114,245,0.08)' : 'transparent',
          }}>
          <Star size={14} style={{ color: isManager ? 'var(--accent)' : 'var(--text-muted)' }} />
          <div className="text-left">
            <p className="text-xs font-medium" style={{ color: isManager ? 'var(--accent)' : 'var(--text-primary)' }}>
              Appoint as manager
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Designates this person as the responsible manager for this job
            </p>
          </div>
        </button>

        <div className="grid grid-cols-2 gap-3">
          {[['startDate', 'Start date', startDate, setStartDate], ['endDate', 'End date (optional)', endDate, setEndDate]].map(
            ([key, label, val, setter]: any) => (
              <div key={key}>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
                <input type="date" value={val} onChange={e => setter(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
            )
          )}
        </div>

        {error && <p className="text-xs" style={{ color: 'var(--critical)' }}>{error}</p>}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-xs border hover:opacity-80"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--accent)' }}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Briefcase size={12} />}
            Appoint
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Person profile modal ──────────────────────────────────────────────────────
function PersonProfileModal({ person, appointments, canEdit, onClose, onEditAppt, onEditPerson }: {
  person: Person
  appointments: Appointment[]
  canEdit: boolean
  onClose: () => void
  onEditAppt: (a: Appointment) => void
  onEditPerson: (p: Person) => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const mine = appointments.filter(a => a.person_id === person.id)
  const active  = mine.filter(a => !a.end_date || a.end_date >= today)
  const expired = mine.filter(a => a.end_date && a.end_date < today)
    .sort((a, b) => (b.end_date ?? '').localeCompare(a.end_date ?? ''))

  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [localNotes, setLocalNotes] = useState<Record<string, string | null>>(
    Object.fromEntries(mine.map(a => [a.id, a.notes]))
  )

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function duration(start: string | null, end: string | null): string {
    if (!start) return ''
    const s = new Date(start)
    const e = end ? new Date(end) : new Date()
    const days = Math.round((e.getTime() - s.getTime()) / 86_400_000)
    if (days < 7) return `${days}d`
    if (days < 31) return `${Math.round(days / 7)}w`
    const months = Math.round(days / 30.5)
    if (months < 12) return `${months}mo`
    return `${(days / 365).toFixed(1)}yr`
  }

  async function saveNotes(apptId: string) {
    setSavingNotes(true)
    await fetch(`/api/team/appointments/${apptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: notesDraft || null }),
    })
    setLocalNotes(prev => ({ ...prev, [apptId]: notesDraft || null }))
    setSavingNotes(false)
    setEditingNotes(null)
  }

  function JobRow({ a, dim }: { a: Appointment; dim?: boolean }) {
    const jobName = a.site?.name ?? a.project?.name ?? 'Unknown'
    const client  = a.site?.client ?? a.project?.client
    const notes   = localNotes[a.id]
    const isEditing = editingNotes === a.id
    return (
      <div className="rounded-xl border p-4 space-y-2"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)', opacity: dim ? 0.7 : 1 }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{jobName}</p>
              {a.is_manager && (
                <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(250,204,21,0.12)', color: '#facc15' }}>
                  <Star size={8} /> Manager
                </span>
              )}
              {dim && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(148,163,184,0.1)', color: '#94a3b8' }}>
                  Ended
                </span>
              )}
            </div>
            {client && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{client}</p>}
          </div>
          {canEdit && (
            <button onClick={() => onEditAppt(a)} title="Edit appointment"
              className="p-1.5 rounded hover:opacity-80 shrink-0" style={{ color: 'var(--text-muted)' }}>
              <Edit2 size={13} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          {a.role_on_job && (
            <span className="flex items-center gap-1">
              <Briefcase size={10} /> {a.role_on_job}
            </span>
          )}
          {(a.start_date || a.end_date) && (
            <span className="flex items-center gap-1">
              <Calendar size={10} />
              {a.start_date ? fmtDate(a.start_date) : '?'}
              {a.end_date ? ` – ${fmtDate(a.end_date)}` : ' – present'}
            </span>
          )}
          {a.start_date && (
            <span className="flex items-center gap-1">
              <Clock size={10} /> {duration(a.start_date, a.end_date)}
            </span>
          )}
        </div>

        {/* Notes */}
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={notesDraft}
              onChange={e => setNotesDraft(e.target.value)}
              rows={3}
              placeholder="Add manager notes about this appointment…"
              className="w-full rounded-lg px-3 py-2 text-xs border focus:outline-none resize-none"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
            <div className="flex gap-2">
              <button onClick={() => saveNotes(a.id)} disabled={savingNotes}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                style={{ background: 'var(--accent)' }}>
                {savingNotes ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                Save
              </button>
              <button onClick={() => setEditingNotes(null)}
                className="px-3 py-1.5 rounded-lg text-xs border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => canEdit ? (setEditingNotes(a.id), setNotesDraft(notes ?? '')) : null}
            className={`rounded-lg px-3 py-2 text-xs ${canEdit ? 'cursor-text hover:opacity-80' : ''}`}
            style={{ background: 'var(--bg-surface)', color: notes ? 'var(--text-primary)' : 'var(--text-muted)', minHeight: 32 }}>
            {notes ?? (canEdit ? 'Click to add manager notes…' : 'No notes')}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)' }}>
      <div className="w-full max-w-lg rounded-2xl border flex flex-col"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-start gap-4 p-6 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <Avatar name={person.name} size={52} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{person.name}</h2>
              {person.discipline && <DisciplineBadge d={person.discipline} />}
            </div>
            {person.role && <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{person.role}</p>}
            {person.company && (
              <p className="flex items-center gap-1.5 text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                <Building2 size={11} /> {person.company}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {person.email && (
                <a href={`mailto:${person.email}`} className="flex items-center gap-1 text-xs hover:opacity-80"
                  style={{ color: 'var(--accent)' }}>
                  <Mail size={11} /> {person.email}
                </a>
              )}
              {person.phone && (
                <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <Phone size={11} /> {person.phone}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canEdit && (
              <button onClick={() => { onClose(); onEditPerson(person) }}
                className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
                <Edit2 size={14} />
              </button>
            )}
            <button onClick={onClose}><X size={16} style={{ color: 'var(--text-muted)' }} /></button>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 px-6 py-3 border-b text-xs shrink-0"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1.5">
            <MapPin size={11} style={{ color: '#4ade80' }} />
            <span style={{ color: '#4ade80', fontWeight: 600 }}>{active.length}</span> active {active.length === 1 ? 'job' : 'jobs'}
          </span>
          <span className="flex items-center gap-1.5">
            <History size={11} />
            {expired.length} previous {expired.length === 1 ? 'job' : 'jobs'}
          </span>
          {person.person_group && (
            <span className="flex items-center gap-1.5">
              <ClipboardList size={11} />
              {person.person_group}
            </span>
          )}
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {person.notes && (
            <div className="rounded-xl p-3 text-xs italic"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              {person.notes}
            </div>
          )}

          {/* Active appointments */}
          {active.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Current appointments
              </p>
              {active.map(a => <JobRow key={a.id} a={a} />)}
            </div>
          )}

          {/* History */}
          {expired.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                History
              </p>
              {expired.map(a => <JobRow key={a.id} a={a} dim />)}
            </div>
          )}

          {mine.length === 0 && (
            <div className="text-center py-8">
              <Briefcase size={24} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No appointments recorded yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Job card (Teams tab) ──────────────────────────────────────────────────────
function JobCard({ label, type, active, expired, manager, accentColor, accentBg, canEdit, onAdd, onEdit, onRemove }: {
  label: string; type: 'site' | 'project'
  active: Appointment[]; expired: Appointment[]
  manager: Appointment | undefined
  accentColor: string; accentBg: string; canEdit: boolean
  onAdd: () => void; onEdit: (a: Appointment) => void; onRemove: (id: string) => void
}) {
  const [showHistory, setShowHistory] = useState(false)

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function ApptRow({ a, dim }: { a: Appointment; dim?: boolean }) {
    return (
      <div className="flex items-center gap-3 px-5 py-3" style={{ opacity: dim ? 0.6 : 1 }}>
        <Avatar name={a.person?.name ?? '?'} size={32} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{a.person?.name}</p>
            {a.is_manager && (
              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(250,204,21,0.12)', color: '#facc15' }}>
                <Star size={8} /> Manager
              </span>
            )}
            {dim && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(148,163,184,0.12)', color: '#94a3b8' }}>
                Ended
              </span>
            )}
            {a.person?.discipline && <DisciplineBadge d={a.person.discipline} />}
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {a.role_on_job ?? a.person?.role ?? '—'}
            {a.start_date ? ` · ${fmtDate(a.start_date)}` : ''}
            {a.end_date ? ` – ${fmtDate(a.end_date)}` : ''}
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => onEdit(a)} title="Edit appointment"
              className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
              <Edit2 size={13} />
            </button>
            {!dim && (
              <button onClick={() => onRemove(a.id)} title="Remove appointment"
                className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
                <X size={13} />
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: accentBg }}>
          {type === 'site' ? <HardHat size={16} style={{ color: accentColor }} /> : <Briefcase size={16} style={{ color: accentColor }} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {type === 'site' ? 'Construction site' : 'Design project'}
            {manager ? ` · ${manager.person?.name} (Manager)` : ' · No manager assigned'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80' }}>
            {active.length} active
          </span>
          {expired.length > 0 && (
            <button onClick={() => setShowHistory(v => !v)}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border hover:opacity-80 transition-opacity"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              <History size={11} /> {expired.length} history
            </button>
          )}
          {canEdit && (
            <button onClick={onAdd}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border hover:opacity-80"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              <Plus size={11} /> Add
            </button>
          )}
        </div>
      </div>

      {/* Active appointments */}
      {active.length > 0 && (
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {active.map(a => <ApptRow key={a.id} a={a} />)}
        </div>
      )}
      {active.length === 0 && (
        <p className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>No active appointments.</p>
      )}

      {/* History */}
      {showHistory && expired.length > 0 && (
        <div className="border-t" style={{ borderColor: 'var(--border)' }}>
          <p className="px-5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            History
          </p>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {expired.map(a => <ApptRow key={a.id} a={a} dim />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Edit appointment modal ────────────────────────────────────────────────────
function EditAppointmentModal({ appt, onClose, onSaved }: {
  appt: Appointment; onClose: () => void; onSaved: (a: Appointment) => void
}) {
  const [form, setForm] = useState({
    role_on_job: appt.role_on_job ?? '',
    is_manager: appt.is_manager,
    start_date: appt.start_date ?? '',
    end_date: appt.end_date ?? '',
    notes: appt.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    setSaving(true); setError('')
    const res = await fetch(`/api/team/appointments/${appt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Save failed'); return }
    onSaved(data as Appointment)
  }

  const jobName = appt.site?.name ?? appt.project?.name ?? 'this job'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-md rounded-2xl border p-6 space-y-4"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Edit appointment
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {appt.person?.name} · {jobName}
            </p>
          </div>
          <button onClick={onClose}><X size={16} style={{ color: 'var(--text-muted)' }} /></button>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Role on this job</label>
          <input type="text" value={form.role_on_job} onChange={e => set('role_on_job', e.target.value)}
            placeholder={appt.person?.role ?? 'e.g. Site Foreman'}
            className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none"
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          />
        </div>

        <button onClick={() => set('is_manager', !form.is_manager)}
          className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2.5 border transition-all"
          style={{
            borderColor: form.is_manager ? 'var(--accent)' : 'var(--border)',
            background: form.is_manager ? 'rgba(108,114,245,0.08)' : 'transparent',
          }}>
          <Star size={14} style={{ color: form.is_manager ? 'var(--accent)' : 'var(--text-muted)' }} />
          <p className="text-xs font-medium" style={{ color: form.is_manager ? 'var(--accent)' : 'var(--text-primary)' }}>
            Appointed as manager
          </p>
        </button>

        <div className="grid grid-cols-2 gap-3">
          {([['start_date', 'Start date'], ['end_date', 'End date']] as const).map(([key, label]) => (
            <div key={key}>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
              <input type="date" value={(form as any)[key]} onChange={e => set(key, e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
          ))}
        </div>

        {form.end_date && (
          <p className="text-xs flex items-center gap-1.5 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(251,146,60,0.08)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.2)' }}>
            <Calendar size={11} />
            Once the end date passes this appointment will move to history automatically.
          </p>
        )}

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
            className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none resize-none"
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          />
        </div>

        {error && <p className="text-xs" style={{ color: 'var(--critical)' }}>{error}</p>}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-xs border hover:opacity-80"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--accent)' }}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            Save changes
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TeamClient({ people: init, appointments: initAppts, projects, sites, currentUserId, canEdit }: Props) {
  const supabase = createClient()
  const [tab, setTab] = useState<'library' | 'teams'>('library')
  const [people, setPeople] = useState(init)
  const [appointments, setAppointments] = useState(initAppts)
  const [search, setSearch] = useState('')
  const [discFilter, setDiscFilter] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [addingPerson, setAddingPerson] = useState(false)
  const [editingPerson, setEditingPerson] = useState<Person | null>(null)
  const [viewingPerson, setViewingPerson] = useState<Person | null>(null)
  const [appointingPerson, setAppointingPerson] = useState<Person | null>(null)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)
  const activePeople   = people.filter(p => p.is_active !== false)
  const inactivePeople = people.filter(p => p.is_active === false)

  // Filtered library — always against active people (inactive shown separately)
  const filtered = activePeople.filter(p => {
    const q = search.toLowerCase()
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || (p.role ?? '').toLowerCase().includes(q) || (p.company ?? '').toLowerCase().includes(q)
    const matchesDisc = !discFilter || p.discipline === discFilter
    return matchesSearch && matchesDisc
  })

  // Group appointments by job
  const byJob: Record<string, { label: string; type: 'site' | 'project'; appts: Appointment[] }> = {}
  for (const a of appointments) {
    const key = a.site_id ?? a.project_id ?? 'unknown'
    const label = a.site?.name ?? a.project?.name ?? 'Unknown job'
    if (!byJob[key]) byJob[key] = { label, type: a.site_id ? 'site' : 'project', appts: [] }
    byJob[key].appts.push(a)
  }

  async function toggleActive(person: Person) {
    const newVal = !person.is_active
    await supabase.from('people').update({ is_active: newVal }).eq('id', person.id)
    setPeople(prev => prev.map(p => p.id === person.id ? { ...p, is_active: newVal } : p))
  }

  async function deletePerson(id: string) {
    await supabase.from('people').delete().eq('id', id)
    setPeople(p => p.filter(x => x.id !== id))
  }

  async function removeAppointment(id: string) {
    await supabase.from('job_appointments').delete().eq('id', id)
    setAppointments(a => a.filter(x => x.id !== id))
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UsersRound size={22} style={{ color: 'var(--accent)' }} />
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Team</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {activePeople.length} active · {inactivePeople.length} inactive · {appointments.length} appointments
            </p>
          </div>
        </div>
        {canEdit && tab === 'library' && (
          <button onClick={() => setAddingPerson(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'var(--accent)' }}>
            <Plus size={14} /> Add person
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
        {([
          { key: 'library', label: `People Library (${people.length})` },
          { key: 'teams',   label: `My Teams (${Object.keys(byJob).length} jobs)` },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
            style={{
              borderBottomColor: tab === t.key ? 'var(--accent)' : 'transparent',
              color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)',
            }}>{t.label}</button>
        ))}
      </div>

      {/* ── Library tab ─────────────────────────────────────────────────────── */}
      {tab === 'library' && (
        <div className="space-y-4">
          {/* Search + filter */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, role, company…"
                className="w-full rounded-lg pl-8 pr-3 py-2 text-sm border focus:outline-none"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setDiscFilter('')}
                className="px-2.5 py-1.5 rounded-lg text-xs border transition-colors"
                style={{
                  background: !discFilter ? 'rgba(108,114,245,0.12)' : 'transparent',
                  borderColor: !discFilter ? 'var(--accent)' : 'var(--border)',
                  color: !discFilter ? 'var(--accent)' : 'var(--text-muted)',
                }}>All</button>
              {DISCIPLINES.map(d => {
                const s = DISC_COLOR[d]
                const active = discFilter === d
                return (
                  <button key={d} onClick={() => setDiscFilter(active ? '' : d)}
                    className="px-2.5 py-1.5 rounded-lg text-xs border transition-colors"
                    style={{
                      background: active ? s.bg : 'transparent',
                      borderColor: active ? s.text : 'var(--border)',
                      color: active ? s.text : 'var(--text-muted)',
                    }}>{d}</button>
                )
              })}
            </div>
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16 rounded-xl border"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
              <UsersRound size={32} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {people.length === 0 ? 'No people in the library yet.' : 'No results for that search.'}
              </p>
              {canEdit && people.length === 0 && (
                <button onClick={() => setAddingPerson(true)}
                  className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white mx-auto"
                  style={{ background: 'var(--accent)' }}>
                  <Plus size={13} /> Add first person
                </button>
              )}
            </div>
          )}

          {(() => {
            // Group people: named groups first in order, then ungrouped under "Other"
            const grouped = new Map<string, Person[]>()
            for (const g of PERSON_GROUPS) grouped.set(g, [])
            grouped.set('Other', [])
            for (const p of filtered) {
              const key = p.person_group && PERSON_GROUPS.includes(p.person_group as any) ? p.person_group : 'Other'
              grouped.get(key)!.push(p)
            }
            return Array.from(grouped.entries())
              .filter(([, members]) => members.length > 0)
              .map(([groupName, members]) => {
                const _today = new Date().toISOString().slice(0, 10)
                const isActiveAppt = (a: Appointment) => a.person_id && (!a.end_date || a.end_date >= _today)
                const appointedInGroup = members.filter(p => appointments.some(a => a.person_id === p.id && isActiveAppt(a))).length
                return (
                <GroupSection key={groupName} title={groupName} count={members.length} appointed={appointedInGroup}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {members.map(p => {
                      const activeAppts = appointments.filter(a => a.person_id === p.id && isActiveAppt(a))
                      const historyCount = appointments.filter(a => a.person_id === p.id && a.end_date && a.end_date < _today).length
                      const jobCount = activeAppts.length
                      return (
                        <div key={p.id} className="rounded-xl border p-4 space-y-3"
                          style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
                          <div className="flex items-start gap-3">
                            <button onClick={() => setViewingPerson(p)} className="shrink-0 hover:opacity-80 transition-opacity">
                              <Avatar name={p.name} size={36} />
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <button onClick={() => setViewingPerson(p)}
                                  className="text-sm font-semibold truncate hover:opacity-80 transition-opacity text-left"
                                  style={{ color: 'var(--text-primary)' }}>{p.name}</button>
                                {p.discipline && <DisciplineBadge d={p.discipline} />}
                              </div>
                              {p.role && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{p.role}</p>}
                              {p.company && (
                                <p className="flex items-center gap-1 text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                  <Building2 size={10} /> {p.company}
                                </p>
                              )}
                            </div>
                          </div>
                          {(p.email || p.phone) && (
                            <div className="space-y-1">
                              {p.email && (
                                <a href={`mailto:${p.email}`} className="flex items-center gap-1.5 text-xs hover:opacity-80"
                                  style={{ color: 'var(--accent)' }}>
                                  <Mail size={10} /> {p.email}
                                </a>
                              )}
                              {p.phone && (
                                <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                                  <Phone size={10} /> {p.phone}
                                </p>
                              )}
                            </div>
                          )}
                          {p.notes && <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>{p.notes}</p>}
                          <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
                            <button onClick={() => setViewingPerson(p)}
                              className="flex items-center gap-1.5 text-xs hover:opacity-80 transition-opacity"
                              style={{ color: 'var(--accent)' }}>
                              <History size={11} />
                              {jobCount > 0
                                ? <>{jobCount} active{historyCount > 0 ? ` · ${historyCount} history` : ''}</>
                                : historyCount > 0
                                  ? <span style={{ color: 'var(--text-muted)' }}>Unassigned · {historyCount} history</span>
                                  : <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}
                            </button>
                            <div className="flex items-center gap-1">
                              {canEdit && (
                                <>
                                  <button onClick={() => setAppointingPerson(p)} title="Appoint to job"
                                    className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--accent)' }}>
                                    <Briefcase size={13} />
                                  </button>
                                  <button onClick={() => setEditingPerson(p)} title="Edit"
                                    className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
                                    <Edit2 size={13} />
                                  </button>
                                  <button onClick={() => toggleActive(p)}
                                    title="Mark inactive — moves to inactive section"
                                    className="px-2 py-0.5 rounded-full text-[10px] border font-medium hover:opacity-80 transition-opacity"
                                    style={{ borderColor: '#4ade80', color: '#4ade80', background: 'rgba(74,222,128,0.08)' }}>
                                    Active
                                  </button>
                                  <button onClick={() => deletePerson(p.id)} title="Remove from library"
                                    className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </GroupSection>
              )})
          })()}

          {/* Inactive section */}
          {inactivePeople.length > 0 && (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setShowInactive(v => !v)}
                className="flex items-center gap-3 w-full text-left px-4 py-3.5 hover:opacity-90 transition-opacity"
                style={{ background: 'var(--bg-elevated)' }}>
                <div className="flex-1 flex items-center gap-3">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Inactive Staff</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                    {inactivePeople.length}
                  </span>
                </div>
                {showInactive
                  ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
                  : <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
              </button>
              {showInactive && (
                <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 opacity-60">
                  {inactivePeople.map(p => (
                    <div key={p.id} className="rounded-xl border p-4 space-y-3"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
                      <div className="flex items-start gap-3">
                        <Avatar name={p.name} size={36} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                            {p.discipline && <DisciplineBadge d={p.discipline} />}
                          </div>
                          {p.role && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{p.role}</p>}
                          {p.company && (
                            <p className="flex items-center gap-1 text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                              <Building2 size={10} /> {p.company}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
                        <span className="text-[10px] px-2 py-0.5 rounded-full border" style={{ borderColor: 'var(--text-muted)', color: 'var(--text-muted)' }}>
                          Inactive
                        </span>
                        {canEdit && (
                          <button onClick={() => toggleActive(p)}
                            className="px-2 py-0.5 rounded-full text-[10px] border font-medium hover:opacity-80 transition-opacity"
                            style={{ borderColor: 'var(--text-muted)', color: 'var(--text-muted)', background: 'transparent' }}>
                            Reactivate
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── My Teams tab ────────────────────────────────────────────────────── */}
      {tab === 'teams' && (() => {
        // People with no appointments at all
        const todayStr = new Date().toISOString().slice(0, 10)
        const appointedIds = new Set(
          appointments.filter(a => !a.end_date || a.end_date >= todayStr).map(a => a.person_id)
        )
        const unassigned = activePeople.filter(p => !appointedIds.has(p.id))

        return (
          <div className="space-y-4">
            {Object.keys(byJob).length === 0 && unassigned.length === 0 && (
              <div className="text-center py-16 rounded-xl border"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
                <Briefcase size={32} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  No appointments yet. Go to the People Library and appoint someone.
                </p>
              </div>
            )}

            {/* Site / project cards */}
            {Object.entries(byJob).map(([jobKey, { label, type, appts }]) => {
              const today = new Date().toISOString().slice(0, 10)
              const active  = appts.filter(a => !a.end_date || a.end_date >= today)
              const expired = appts.filter(a => a.end_date && a.end_date < today)
              const manager = active.find(a => a.is_manager)
              const accentColor = type === 'site' ? '#fb923c' : 'var(--accent)'
              const accentBg   = type === 'site' ? 'rgba(251,146,60,0.12)' : 'rgba(108,114,245,0.12)'
              return (
                <JobCard key={jobKey}
                  label={label} type={type} active={active} expired={expired}
                  manager={manager} accentColor={accentColor} accentBg={accentBg}
                  canEdit={canEdit}
                  onAdd={() => setTab('library')}
                  onEdit={setEditingAppointment}
                  onRemove={removeAppointment}
                />
              )
            })}

            {/* Unassigned active staff */}
            {unassigned.length > 0 && (
              <div className="rounded-xl border overflow-hidden"
                style={{ borderColor: 'rgba(248,113,113,0.4)', background: 'var(--bg-surface)' }}>
                <div className="flex items-center gap-3 px-5 py-4 border-b"
                  style={{ borderColor: 'rgba(248,113,113,0.2)', background: 'rgba(248,113,113,0.06)' }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(248,113,113,0.12)' }}>
                    <UsersRound size={16} style={{ color: '#f87171' }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Unassigned</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Active staff with no job appointments
                    </p>
                  </div>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
                    {unassigned.length} staff
                  </span>
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {unassigned.map(p => (
                    <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                      <Avatar name={p.name} size={32} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                          {p.discipline && <DisciplineBadge d={p.discipline} />}
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {p.role ?? '—'}{p.company ? ` · ${p.company}` : ''}
                        </p>
                      </div>
                      {canEdit && (
                        <button onClick={() => setAppointingPerson(p)}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border hover:opacity-80"
                          style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                          <Briefcase size={11} /> Appoint
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Modals */}
      {(addingPerson || editingPerson) && (
        <PersonModal
          person={editingPerson ?? undefined}
          onClose={() => { setAddingPerson(false); setEditingPerson(null) }}
          onSaved={p => {
            if (editingPerson) setPeople(prev => prev.map(x => x.id === p.id ? p : x))
            else setPeople(prev => [...prev, p])
            setAddingPerson(false); setEditingPerson(null)
          }}
        />
      )}
      {appointingPerson && (
        <AppointModal
          person={appointingPerson}
          projects={projects} sites={sites}
          currentUserId={currentUserId}
          onClose={() => setAppointingPerson(null)}
          onSaved={a => {
            setAppointments(prev => [a, ...prev])
            setAppointingPerson(null)
            setTab('teams')
          }}
        />
      )}
      {editingAppointment && (
        <EditAppointmentModal
          appt={editingAppointment}
          onClose={() => setEditingAppointment(null)}
          onSaved={updated => {
            setAppointments(prev => prev.map(a => a.id === updated.id ? updated : a))
            setEditingAppointment(null)
          }}
        />
      )}
      {viewingPerson && (
        <PersonProfileModal
          person={viewingPerson}
          appointments={appointments}
          canEdit={canEdit}
          onClose={() => setViewingPerson(null)}
          onEditAppt={a => { setViewingPerson(null); setEditingAppointment(a) }}
          onEditPerson={p => setEditingPerson(p)}
        />
      )}
    </div>
  )
}
