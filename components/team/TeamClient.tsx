'use client'

import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import TimesheetTab from '@/components/team/TimesheetTab'
import HolidayTab from '@/components/team/HolidayTab'
import InboxTab from '@/components/team/InboxTab'
import {
  UsersRound, Plus, Search, X, ChevronDown, ChevronRight,
  Briefcase, HardHat, Star, Mail, Phone, Building2,
  Loader2, CheckCircle2, Trash2, Edit2, History, Calendar,
  ClipboardList, MapPin, Clock, ShieldCheck, Upload, FileText,
  AlertTriangle, ExternalLink,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────
interface Person {
  id: string; name: string; role: string | null; discipline: string | null
  company: string | null; email: string | null; phone: string | null; notes: string | null
  person_group: string | null; is_active: boolean
  standard_rate: number | null; ot_rate_1: number | null; ot_rate_2: number | null
  holiday_allowance: number | null
}

const PERSON_GROUPS = [
  'SPC Permanent Staff',
  'SPC Supervisors',
  'Agency / Casual Staff',
  'Subcontractors',
  'Clients',
  'Other',
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
  currentUserId: string; canEdit: boolean; userRole: string
}

const DISCIPLINES = ['Plant Operator', 'HGV Driver', 'Fitter / Mechanic', 'Supervisor', 'Management', 'Admin', 'HSEQ']
const DISC_COLOR: Record<string, { bg: string; text: string }> = {
  'Plant Operator':   { bg: 'rgba(251,146,60,0.12)',  text: '#fb923c' },
  'HGV Driver':       { bg: 'rgba(59,130,246,0.12)',  text: '#60a5fa' },
  'Fitter / Mechanic':{ bg: 'rgba(250,204,21,0.12)',  text: '#facc15' },
  Supervisor:         { bg: 'rgba(34,197,94,0.12)',   text: '#4ade80' },
  Management:         { bg: 'rgba(168,85,247,0.12)',  text: '#c084fc' },
  Admin:              { bg: 'rgba(148,163,184,0.12)', text: '#94a3b8' },
  HSEQ:               { bg: 'rgba(248,113,113,0.12)', text: '#f87171' },
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
  const [open, setOpen] = useState(false)
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
    standard_rate: person?.standard_rate?.toString() ?? '',
    ot_rate_1: person?.ot_rate_1?.toString() ?? '',
    ot_rate_2: person?.ot_rate_2?.toString() ?? '',
    holiday_allowance: person?.holiday_allowance?.toString() ?? '28',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.name.trim()) { setError('Name is required'); return }
    if (!form.email.trim()) { setError('Email is required'); return }
    setSaving(true); setError('')
    const payload = {
      name: form.name.trim(), role: form.role || null, discipline: form.discipline || null,
      company: form.company || null, email: form.email.trim(), phone: form.phone || null,
      notes: form.notes || null, person_group: form.person_group || null,
      is_active: form.is_active,
      standard_rate: form.standard_rate ? parseFloat(form.standard_rate) : null,
      ot_rate_1: form.ot_rate_1 ? parseFloat(form.ot_rate_1) : null,
      ot_rate_2: form.ot_rate_2 ? parseFloat(form.ot_rate_2) : null,
      holiday_allowance: form.holiday_allowance ? parseInt(form.holiday_allowance) : 28,
    }
    let data: Person | null = null
    if (person) {
      const { data: d, error: err } = await supabase.from('people').update(payload).eq('id', person.id).select().single()
      setSaving(false)
      if (err) { setError(err.message); return }
      data = d as Person
    } else {
      const res = await fetch('/api/team/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setSaving(false)
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to add person'); return }
      data = json.person as Person
    }
    onSaved(data!)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-lg rounded-2xl border flex flex-col"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', maxHeight: '90vh' }}>

        {/* Fixed header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {person ? 'Edit person' : 'Add person'}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:opacity-70">
            <X size={16} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'name',    label: 'Full name *', span: true  },
              { key: 'email',   label: 'Email *',     span: true  },
              { key: 'role',    label: 'Job title',   span: false },
              { key: 'company', label: 'Company',     span: false },
              { key: 'phone',   label: 'Phone',       span: false },
            ].map(({ key, label, span }) => (
              <div key={key} className={span ? 'col-span-2' : ''}>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
                <input type={key === 'email' ? 'email' : 'text'} value={(form as any)[key]}
                  onChange={e => set(key, e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
            ))}

            <div className="col-span-2">
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Discipline</label>
              <div className="flex flex-wrap gap-2">
                {DISCIPLINES.map(d => (
                  <button key={d} type="button" onClick={() => set('discipline', form.discipline === d ? '' : d)}
                    className="px-3 py-1.5 rounded-full text-xs border transition-all"
                    style={{
                      borderColor: form.discipline === d ? 'var(--accent)' : 'var(--border)',
                      background: form.discipline === d ? 'rgba(108,114,245,0.15)' : 'transparent',
                      color: form.discipline === d ? 'var(--accent)' : 'var(--text-muted)',
                    }}>{d}</button>
                ))}
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Group</label>
              <div className="flex flex-wrap gap-2">
                {PERSON_GROUPS.map(g => (
                  <button key={g} type="button" onClick={() => set('person_group', form.person_group === g ? '' : g)}
                    className="px-3 py-1.5 rounded-full text-xs border transition-all"
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

            <div className="col-span-2 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Pay rates & holiday</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'standard_rate',    label: 'Standard rate (£/hr)' },
                  { key: 'holiday_allowance', label: 'Holiday allowance (days)' },
                  { key: 'ot_rate_1',        label: 'OT Rate 1 (£/hr)' },
                  { key: 'ot_rate_2',        label: 'OT Rate 2 (£/hr)' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
                    <input type="number" min="0" step={key === 'holiday_allowance' ? '1' : '0.01'}
                      value={(form as any)[key]}
                      onChange={e => set(key, e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none"
                      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Fixed footer */}
        <div className="px-6 py-4 border-t shrink-0 flex items-center justify-between gap-3"
          style={{ borderColor: 'var(--border)' }}>
          {error
            ? <p className="text-xs flex-1" style={{ color: 'var(--critical)' }}>{error}</p>
            : <span />}
          <div className="flex gap-2 shrink-0">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs border hover:opacity-80"
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
function PersonProfileModal({ person, appointments, canEdit, onClose, onEditAppt, onEditPerson, onNotesSaved }: {
  person: Person
  appointments: Appointment[]
  canEdit: boolean
  onClose: () => void
  onEditAppt: (a: Appointment) => void
  onEditPerson: (p: Person) => void
  onNotesSaved: (apptId: string, notes: string | null) => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const mine = appointments.filter(a => a.person_id === person.id)
  const active  = mine.filter(a => !a.end_date || a.end_date >= today)
  const expired = mine.filter(a => a.end_date && a.end_date < today)
    .sort((a, b) => (b.end_date ?? '').localeCompare(a.end_date ?? ''))

  const [profileTab, setProfileTab] = useState<'appointments' | 'credentials' | 'timesheets'>('appointments')
  const [holDaysUsed, setHolDaysUsed] = useState<number | null>(null)
  const supabaseProfile = createClient()

  useEffect(() => {
    const year = new Date().getFullYear()
    supabaseProfile.from('holiday_bookings')
      .select('days_taken')
      .eq('person_id', person.id)
      .eq('status', 'Approved')
      .gte('start_date', `${year}-01-01`)
      .lte('end_date', `${year}-12-31`)
      .then(({ data }) => {
        setHolDaysUsed((data ?? []).reduce((s, b) => s + b.days_taken, 0))
      })
  }, [person.id])

  const holTotal = person.holiday_allowance ?? 28
  const holRemaining = holDaysUsed !== null ? holTotal - holDaysUsed : null

  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [localNotes, setLocalNotes] = useState<Record<string, string | null>>(
    Object.fromEntries(mine.map(a => [a.id, a.notes]))
  )

  // ── Credentials state ──
  interface Credential {
    id: string; person_id: string; credential_type: string; name: string
    issuer: string | null; reference: string | null; issue_date: string | null
    expiry_date: string | null; notes: string | null; created_at: string
    certificates: { id: string; file_name: string; storage_path: string; uploaded_at: string }[]
  }
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [credsLoading, setCredsLoading] = useState(false)
  const [credsLoaded, setCredsLoaded] = useState(false)
  const [addingCred, setAddingCred] = useState(false)
  const [editingCred, setEditingCred] = useState<Credential | null>(null)
  const [credForm, setCredForm] = useState({ credential_type: 'certification', name: '', issuer: '', reference: '', issue_date: '', expiry_date: '', notes: '' })
  const [savingCred, setSavingCred] = useState(false)
  const [credError, setCredError] = useState('')
  const [uploadingCertFor, setUploadingCertFor] = useState<string | null>(null)
  const certFileRef = useRef<HTMLInputElement | null>(null)
  const [certCredId, setCertCredId] = useState<string | null>(null)

  async function loadCredentials() {
    if (credsLoaded) return
    setCredsLoading(true)
    const res = await fetch(`/api/team/people/${person.id}/credentials`)
    if (res.ok) setCredentials(await res.json())
    setCredsLoaded(true)
    setCredsLoading(false)
  }

  function openCredTab() { setProfileTab('credentials'); loadCredentials() }

  // ── Weekly timesheets state ──
  interface WTSDay {
    work_date: string; hours_regular: number; hours_ot1: number; hours_ot2: number; is_holiday: boolean
  }
  interface WTS {
    id: string; week_starting: string
    status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected'
    signed_off_by_name: string | null; signed_off_at: string | null; sign_off_notes: string | null
    bonus: number; days: WTSDay[]
  }
  interface HolBooking { start_date: string; end_date: string; days_taken: number }
  const [wtsSheets, setWtsSheets] = useState<WTS[]>([])
  const [wtsHolidays, setWtsHolidays] = useState<HolBooking[]>([])
  const [tsLoading, setTsLoading] = useState(false)
  const [tsLoaded, setTsLoaded] = useState(false)

  async function loadTimesheets() {
    if (tsLoaded) return
    setTsLoading(true)
    const res = await fetch(`/api/team/people/${person.id}/weekly-timesheets`)
    if (res.ok) {
      const data = await res.json()
      setWtsSheets((data.timesheets ?? []).map((ts: any) => ({ ...ts, days: ts.timesheet_days ?? [] })))
      setWtsHolidays(data.holidays ?? [])
    }
    setTsLoaded(true)
    setTsLoading(false)
  }

  function openTsTab() { setProfileTab('timesheets'); loadTimesheets() }

  function isHolDay(date: string): boolean {
    const dow = new Date(date + 'T00:00:00').getDay()
    if (dow === 0 || dow === 6) return false
    return wtsHolidays.some(b => b.start_date <= date && date <= b.end_date)
  }

  function localDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  function wtsWeekPay(sheet: WTS): number {
    const std = person.standard_rate ?? 0
    const ot1 = person.ot_rate_1 ?? std
    const ot2 = person.ot_rate_2 ?? std
    // Mon–Sun for this week
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sheet.week_starting + 'T00:00:00'); d.setDate(d.getDate() + i)
      return localDateStr(d)
    })
    let pay = 0
    for (const date of dates) {
      if (isHolDay(date)) { pay += 10 * std; continue }
      const day = sheet.days.find(d => d.work_date === date)
      if (day) pay += day.hours_regular * std + day.hours_ot1 * ot1 + day.hours_ot2 * ot2
    }
    return pay + (sheet.bonus ?? 0)
  }

  function wtsWeekHours(sheet: WTS): { reg: number; ot1: number; ot2: number; hol: number } {
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sheet.week_starting + 'T00:00:00'); d.setDate(d.getDate() + i)
      return localDateStr(d)
    })
    let reg = 0, ot1 = 0, ot2 = 0, hol = 0
    for (const date of dates) {
      if (isHolDay(date)) { hol += 1; continue }
      const day = sheet.days.find(d => d.work_date === date)
      if (day) { reg += day.hours_regular; ot1 += day.hours_ot1; ot2 += day.hours_ot2 }
    }
    return { reg, ot1, ot2, hol }
  }

  function credExpiryStatus(expiry: string | null): 'valid' | 'soon' | 'expired' | 'none' {
    if (!expiry) return 'none'
    const days = Math.round((new Date(expiry).getTime() - new Date().getTime()) / 86_400_000)
    if (days < 0) return 'expired'
    if (days <= 30) return 'soon'
    return 'valid'
  }

  function resetCredForm() {
    setCredForm({ credential_type: 'certification', name: '', issuer: '', reference: '', issue_date: '', expiry_date: '', notes: '' })
    setCredError(''); setAddingCred(false); setEditingCred(null)
  }

  async function saveCred() {
    if (!credForm.name.trim()) { setCredError('Name is required'); return }
    setSavingCred(true); setCredError('')
    if (editingCred) {
      const res = await fetch(`/api/team/credentials/${editingCred.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credForm),
      })
      const data = await res.json()
      if (!res.ok) { setCredError(data.error); setSavingCred(false); return }
      setCredentials(prev => prev.map(c => c.id === data.id ? data : c))
    } else {
      const res = await fetch(`/api/team/people/${person.id}/credentials`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credForm),
      })
      const data = await res.json()
      if (!res.ok) { setCredError(data.error); setSavingCred(false); return }
      setCredentials(prev => [...prev, data])
    }
    setSavingCred(false); resetCredForm()
  }

  async function deleteCred(id: string) {
    await fetch(`/api/team/credentials/${id}`, { method: 'DELETE' })
    setCredentials(prev => prev.filter(c => c.id !== id))
  }

  async function uploadCert(file: File, credId: string) {
    setUploadingCertFor(credId)
    const form = new FormData(); form.set('file', file)
    const res = await fetch(`/api/team/credentials/${credId}/certificate`, { method: 'POST', body: form })
    const data = await res.json()
    if (res.ok) {
      setCredentials(prev => prev.map(c => c.id === credId
        ? { ...c, certificates: [...c.certificates, data] } : c))
    }
    setUploadingCertFor(null)
  }

  async function openCert(credId: string, storagePath: string) {
    const res = await fetch(`/api/team/credentials/${credId}/certificate`)
    if (!res.ok) return
    const items = await res.json()
    const match = items.find((i: any) => i.storage_path === storagePath)
    if (match?.url) window.open(match.url, '_blank')
  }

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
    const saved = notesDraft || null
    await fetch(`/api/team/appointments/${apptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: saved }),
    })
    setLocalNotes(prev => ({ ...prev, [apptId]: saved }))
    onNotesSaved(apptId, saved)
    setSavingNotes(false)
    setEditingNotes(null)
  }

  function renderJobRow(a: Appointment, dim?: boolean) {
    const jobName = a.site?.name ?? a.project?.name ?? 'Unknown'
    const client  = a.site?.client ?? a.project?.client
    const notes   = localNotes[a.id]
    const isEditing = editingNotes === a.id
    return (
      <div key={a.id} className="rounded-xl border p-4 space-y-2"
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
              autoFocus
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
            onClick={() => canEdit ? (setEditingNotes(a.id), setNotesDraft(notes ?? '')) : undefined}
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
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-2">
              {canEdit && (
                <button onClick={() => { onClose(); onEditPerson(person) }}
                  className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
                  <Edit2 size={14} />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 rounded hover:opacity-80">
                <X size={16} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
            {holRemaining !== null && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
                style={{
                  background: holRemaining <= 5 ? 'rgba(239,68,68,0.12)' : holRemaining <= 10 ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)',
                  color: holRemaining <= 5 ? '#ef4444' : holRemaining <= 10 ? '#f59e0b' : '#22c55e',
                  border: `1px solid ${holRemaining <= 5 ? 'rgba(239,68,68,0.3)' : holRemaining <= 10 ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)'}`,
                }}>
                <Calendar size={10} />
                {holRemaining}d holiday left
              </div>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          {([
            { key: 'appointments', label: `Appointments (${mine.length})` },
            { key: 'credentials',  label: 'Credentials' },
            { key: 'timesheets',   label: 'Timesheets' },
          ] as const).map(t => (
            <button key={t.key}
              onClick={() => t.key === 'credentials' ? openCredTab() : t.key === 'timesheets' ? openTsTab() : setProfileTab('appointments')}
              className="px-4 py-2.5 text-xs font-medium border-b-2 transition-colors"
              style={{
                borderBottomColor: profileTab === t.key ? 'var(--accent)' : 'transparent',
                color: profileTab === t.key ? 'var(--accent)' : 'var(--text-muted)',
              }}>{t.label}</button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-5">

          {/* ── Appointments tab ── */}
          {profileTab === 'appointments' && (
            <div className="space-y-5">
              {person.notes && (
                <div className="rounded-xl p-3 text-xs italic"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  {person.notes}
                </div>
              )}
              {active.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Current</p>
                  {active.map(a => renderJobRow(a))}
                </div>
              )}
              {expired.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>History</p>
                  {expired.map(a => renderJobRow(a, true))}
                </div>
              )}
              {mine.length === 0 && (
                <div className="text-center py-8">
                  <Briefcase size={24} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No appointments recorded yet.</p>
                </div>
              )}
            </div>
          )}

          {/* ── Credentials tab ── */}
          {profileTab === 'credentials' && (
            <div className="space-y-4">
              {canEdit && !addingCred && !editingCred && (
                <button onClick={() => setAddingCred(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border hover:opacity-80"
                  style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                  <Plus size={12} /> Add credential
                </button>
              )}

              {/* Add / edit form */}
              {(addingCred || editingCred) && (
                <div className="rounded-xl border p-4 space-y-3"
                  style={{ borderColor: 'var(--accent)', background: 'rgba(108,114,245,0.05)' }}>
                  <p className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                    {editingCred ? 'Edit credential' : 'New credential'}
                  </p>

                  {/* Type pills */}
                  <div className="flex flex-wrap gap-2">
                    {(['certification','competency','authorisation','ticket'] as const).map(t => (
                      <button key={t} onClick={() => setCredForm(f => ({ ...f, credential_type: t }))}
                        className="px-2.5 py-1 rounded-full text-xs border capitalize transition-all"
                        style={{
                          borderColor: credForm.credential_type === t ? 'var(--accent)' : 'var(--border)',
                          background: credForm.credential_type === t ? 'rgba(108,114,245,0.15)' : 'transparent',
                          color: credForm.credential_type === t ? 'var(--accent)' : 'var(--text-muted)',
                        }}>{t}</button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { k: 'name',       label: 'Name *',        span: true  },
                      { k: 'issuer',     label: 'Issuing body',  span: false },
                      { k: 'reference',  label: 'Ref / card no', span: false },
                      { k: 'issue_date', label: 'Issue date',    span: false, type: 'date' },
                      { k: 'expiry_date',label: 'Expiry date',   span: false, type: 'date' },
                    ] as { k: string; label: string; span?: boolean; type?: string }[]).map(({ k, label, span, type }) => (
                      <div key={k} className={span ? 'col-span-2' : ''}>
                        <label className="block text-[10px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
                        <input type={type ?? 'text'} value={(credForm as any)[k]}
                          onChange={e => setCredForm(f => ({ ...f, [k]: e.target.value }))}
                          className="w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none"
                          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                        />
                      </div>
                    ))}
                    <div className="col-span-2">
                      <label className="block text-[10px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Notes</label>
                      <textarea value={credForm.notes} onChange={e => setCredForm(f => ({ ...f, notes: e.target.value }))}
                        rows={2} className="w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none resize-none"
                        style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                    </div>
                  </div>

                  {credError && <p className="text-xs" style={{ color: 'var(--critical)' }}>{credError}</p>}
                  <div className="flex gap-2">
                    <button onClick={saveCred} disabled={savingCred}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                      style={{ background: 'var(--accent)' }}>
                      {savingCred ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                      Save
                    </button>
                    <button onClick={resetCredForm} className="px-3 py-1.5 rounded-lg text-xs border"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Cancel</button>
                  </div>
                </div>
              )}

              {credsLoading && (
                <div className="flex items-center justify-center py-8 gap-2" style={{ color: 'var(--text-muted)' }}>
                  <Loader2 size={14} className="animate-spin" /><span className="text-xs">Loading…</span>
                </div>
              )}

              {!credsLoading && credentials.length === 0 && !addingCred && (
                <div className="text-center py-8">
                  <ShieldCheck size={24} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No credentials recorded yet.</p>
                </div>
              )}

              {credentials.map(c => {
                const status = credExpiryStatus(c.expiry_date)
                const statusColor = status === 'expired' ? '#f87171' : status === 'soon' ? '#fb923c' : status === 'valid' ? '#4ade80' : 'var(--text-muted)'
                const typeColor: Record<string, string> = { certification: '#60a5fa', competency: '#c084fc', authorisation: '#fb923c', ticket: '#4ade80' }
                return (
                  <div key={c.id} className="rounded-xl border p-4 space-y-2"
                    style={{ borderColor: status === 'expired' ? 'rgba(248,113,113,0.3)' : status === 'soon' ? 'rgba(251,146,60,0.3)' : 'var(--border)', background: 'var(--bg-elevated)' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded capitalize"
                            style={{ background: `${typeColor[c.credential_type] ?? 'var(--accent)'}22`, color: typeColor[c.credential_type] ?? 'var(--accent)' }}>
                            {c.credential_type}
                          </span>
                          {status !== 'none' && (
                            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded"
                              style={{ background: `${statusColor}18`, color: statusColor }}>
                              {status === 'expired' ? <AlertTriangle size={9} /> : <ShieldCheck size={9} />}
                              {status === 'expired' ? 'Expired' : status === 'soon' ? 'Expiring soon' : 'Valid'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3 mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {c.issuer && <span>{c.issuer}</span>}
                          {c.reference && <span>Ref: {c.reference}</span>}
                          {c.issue_date && <span>Issued {fmtDate(c.issue_date)}</span>}
                          {c.expiry_date && (
                            <span style={{ color: statusColor }}>Expires {fmtDate(c.expiry_date)}</span>
                          )}
                        </div>
                        {c.notes && <p className="text-xs mt-1 italic" style={{ color: 'var(--text-muted)' }}>{c.notes}</p>}
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => { setEditingCred(c); setAddingCred(false); setCredForm({ credential_type: c.credential_type, name: c.name, issuer: c.issuer??'', reference: c.reference??'', issue_date: c.issue_date??'', expiry_date: c.expiry_date??'', notes: c.notes??'' }) }}
                            className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
                            <Edit2 size={12} />
                          </button>
                          <button onClick={() => deleteCred(c.id)}
                            className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Certificates */}
                    <div className="flex flex-wrap gap-2 mt-1">
                      {c.certificates.map(cert => (
                        <button key={cert.id} onClick={() => openCert(c.id, cert.storage_path)}
                          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border hover:opacity-80"
                          style={{ borderColor: 'var(--border)', color: 'var(--accent)' }}>
                          <FileText size={10} /> {cert.file_name} <ExternalLink size={9} />
                        </button>
                      ))}
                      {canEdit && (
                        <button
                          onClick={() => { setCertCredId(c.id); certFileRef.current?.click() }}
                          disabled={uploadingCertFor === c.id}
                          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border hover:opacity-80 disabled:opacity-50"
                          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                          {uploadingCertFor === c.id
                            ? <Loader2 size={10} className="animate-spin" />
                            : <Upload size={10} />}
                          Upload cert
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Hidden file input for certificate upload */}
              <input ref={certFileRef} type="file" accept="*/*" className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f && certCredId) uploadCert(f, certCredId)
                  if (certFileRef.current) certFileRef.current.value = ''
                }} />
            </div>
          )}

          {/* ── Timesheets tab ── */}
          {profileTab === 'timesheets' && (
            <div className="space-y-3">
              {tsLoading && (
                <div className="flex items-center gap-2 py-8 justify-center">
                  <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading timesheets…</span>
                </div>
              )}
              {tsLoaded && wtsSheets.length === 0 && (
                <div className="text-center py-8">
                  <Clock size={24} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No timesheet records yet.</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Timesheets appear here once created in the Timesheets tab.</p>
                </div>
              )}
              {tsLoaded && wtsSheets.map(sheet => {
                const STATUS_CFG = {
                  Draft:     { label: 'Draft',     color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
                  Submitted: { label: 'Submitted', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
                  Approved:  { label: 'Approved',  color: '#22c55e', bg: 'rgba(34,197,94,0.12)'  },
                  Rejected:  { label: 'Rejected',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
                }
                const cfg = STATUS_CFG[sheet.status]
                const weekEnd = new Date(sheet.week_starting + 'T00:00:00'); weekEnd.setDate(weekEnd.getDate() + 6)
                const weekLabel = `${new Date(sheet.week_starting + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                const hrs = wtsWeekHours(sheet)
                const totalHrs = hrs.reg + hrs.ot1 + hrs.ot2 + hrs.hol * 10
                const pay = wtsWeekPay(sheet)
                const isApproved = sheet.status === 'Approved'
                const borderColor = isApproved ? 'rgba(34,197,94,0.3)' : 'var(--border)'
                const bgColor = isApproved ? 'rgba(34,197,94,0.04)' : 'var(--bg-elevated)'

                // Days Mon–Sun for the week
                const weekDates = Array.from({ length: 7 }, (_, i) => {
                  const d = new Date(sheet.week_starting + 'T00:00:00'); d.setDate(d.getDate() + i)
                  return d.toISOString().slice(0, 10)
                })
                const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

                return (
                  <div key={sheet.id} className="rounded-xl border overflow-hidden"
                    style={{ borderColor, background: bgColor }}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap">
                      <div>
                        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{weekLabel}</p>
                        {sheet.signed_off_by_name && (
                          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Approved by {sheet.signed_off_by_name}
                            {sheet.signed_off_at && ` · ${new Date(sheet.signed_off_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {totalHrs > 0 && (
                          <div className="text-right">
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Hours</p>
                            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{totalHrs.toFixed(1)}h</p>
                          </div>
                        )}
                        {pay > 0 && (
                          <div className="text-right">
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Pay</p>
                            <p className="text-xs font-semibold" style={{ color: '#22c55e' }}>
                              £{pay.toFixed(0)}
                              {(sheet.bonus ?? 0) > 0 && <span className="ml-1 text-[9px] px-1 py-0.5 rounded font-semibold" style={{ background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }}>+£{sheet.bonus} bonus</span>}
                            </p>
                          </div>
                        )}
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                      </div>
                    </div>

                    {/* Day breakdown */}
                    <div className="border-t grid gap-0" style={{ borderColor: 'var(--border)', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                      {weekDates.map((date, i) => {
                        const isHol = isHolDay(date)
                        const day = sheet.days.find(d => d.work_date === date)
                        const h = isHol ? 10 : (day ? day.hours_regular + day.hours_ot1 + day.hours_ot2 : 0)
                        const isWeekend = i >= 5
                        return (
                          <div key={date} className="px-1.5 py-2 text-center border-r last:border-r-0"
                            style={{ borderColor: 'var(--border)', opacity: isWeekend && !h ? 0.35 : 1 }}>
                            <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{DAYS[i]}</p>
                            <p className="text-[10px] font-semibold mt-0.5"
                              style={{ color: isHol ? '#f59e0b' : h > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                              {isHol ? 'HOL' : h > 0 ? `${h}h` : '—'}
                            </p>
                            {day && !isHol && (day.hours_ot1 > 0 || day.hours_ot2 > 0) && (
                              <p className="text-[8px] mt-0.5" style={{ color: '#f59e0b' }}>
                                {day.hours_ot1 > 0 ? `+${day.hours_ot1}OT` : ''}{day.hours_ot2 > 0 ? ` +${day.hours_ot2}OT2` : ''}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Hol days / sign-off note */}
                    {(hrs.hol > 0 || sheet.sign_off_notes) && (
                      <div className="border-t px-4 py-2 flex items-center gap-4 flex-wrap" style={{ borderColor: 'var(--border)' }}>
                        {hrs.hol > 0 && (
                          <span className="text-[11px]" style={{ color: '#f59e0b' }}>
                            {hrs.hol} holiday day{hrs.hol !== 1 ? 's' : ''} included
                          </span>
                        )}
                        {sheet.sign_off_notes && (
                          <span className="text-[11px] italic" style={{ color: 'var(--text-muted)' }}>"{sheet.sign_off_notes}"</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
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
  const [open, setOpen] = useState(false)
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
      {/* Header — clicking toggles open */}
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:opacity-90 transition-opacity text-left"
        style={{ background: 'var(--bg-elevated)' }}>
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
            <span className="text-xs px-2.5 py-1 rounded-full"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              {expired.length} history
            </span>
          )}
          {open ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
                : <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
        </div>
      </button>

      {open && (
        <>
          {/* Action row */}
          {canEdit && (
            <div className="px-5 py-2 border-b flex justify-end" style={{ borderColor: 'var(--border)' }}>
              <button onClick={e => { e.stopPropagation(); onAdd() }}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border hover:opacity-80"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                <Plus size={11} /> Add person
              </button>
            </div>
          )}

          {/* Active appointments */}
          {active.length > 0 && (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {active.map(a => <ApptRow key={a.id} a={a} />)}
            </div>
          )}
          {active.length === 0 && (
            <p className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>No active appointments.</p>
          )}

          {/* History toggle */}
          {expired.length > 0 && (
            <div className="border-t" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setShowHistory(v => !v)}
                className="flex items-center gap-2 w-full px-5 py-2.5 hover:opacity-80 transition-opacity text-left">
                <History size={12} style={{ color: 'var(--text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {showHistory ? 'Hide' : 'Show'} history ({expired.length})
                </span>
              </button>
              {showHistory && (
                <div className="divide-y border-t" style={{ borderColor: 'var(--border)' }}>
                  {expired.map(a => <ApptRow key={a.id} a={a} dim />)}
                </div>
              )}
            </div>
          )}
        </>
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
export default function TeamClient({ people: init, appointments: initAppts, projects, sites, currentUserId, canEdit, userRole }: Props) {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<'library' | 'teams' | 'timesheets' | 'holidays' | 'inbox'>('library')
  const [people, setPeople] = useState(init)
  const [appointments, setAppointments] = useState(initAppts)
  const [search, setSearch] = useState('')
  const [discFilter, setDiscFilter] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [addingPerson, setAddingPerson] = useState(false)
  const [editingPerson, setEditingPerson] = useState<Person | null>(null)
  const [viewingPerson, setViewingPerson] = useState<Person | null>(null)

  // Auto-open person profile from ?person=<id> URL param
  useEffect(() => {
    const personId = searchParams.get('person')
    if (personId) {
      const match = init.find(p => p.id === personId)
      if (match) setViewingPerson(match)
    }
  }, [searchParams, init])
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
          { key: 'library'    as const, label: `People Library (${people.length})` },
          { key: 'teams'      as const, label: `My Teams (${Object.keys(byJob).length} jobs)` },
          { key: 'timesheets' as const, label: 'Timesheets' },
          { key: 'holidays'   as const, label: 'Holidays' },
          ...(canEdit ? [{ key: 'inbox' as const, label: '📬 Email Inbox' }] : []),
        ]).map(t => (
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

      {/* ── Timesheets tab ────────────────────────────────────────────────────── */}
      {tab === 'timesheets' && (
        <TimesheetTab people={people} canSignOff={canEdit} userRole={userRole} />
      )}

      {/* ── Holidays tab ──────────────────────────────────────────────────────── */}
      {tab === 'holidays' && (
        <HolidayTab people={people} appointments={appointments} canManage={canEdit} userRole={userRole} />
      )}

      {/* ── Email Inbox tab ───────────────────────────────────────────────────── */}
      {tab === 'inbox' && canEdit && (
        <InboxTab />
      )}

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
          onNotesSaved={(apptId, notes) =>
            setAppointments(prev => prev.map(a => a.id === apptId ? { ...a, notes } : a))
          }
        />
      )}
    </div>
  )
}
