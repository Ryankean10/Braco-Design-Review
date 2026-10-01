'use client'

import { useState, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Users, X, Pencil, Trash2, Check, Calendar } from 'lucide-react'

interface Person {
  id: string
  name: string
  role: string | null
  discipline: string | null
  is_active: boolean
}

interface Assignment {
  id: string
  person_id: string
  person_label: string
  date: string
  type: string
  client: string | null
  scope: string | null
  location: string | null
  notes: string | null
  project_id: string | null
}

interface Props {
  people: Person[]
  initialAssignments: Assignment[]
  companyId: string
  canEdit?: boolean
}

const TYPES = ['Work', 'Meeting', 'Travel', 'Holiday', 'Public Holiday', 'Training', 'Personal Appointment', 'Other'] as const
type ActivityType = typeof TYPES[number]

const TYPE_CFG: Record<ActivityType, { color: string; bg: string; border: string; label: string }> = {
  'Work':                 { color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd', label: 'W'  },
  'Meeting':              { color: '#15803d', bg: '#dcfce7', border: '#86efac', label: 'M'  },
  'Travel':               { color: '#0e7490', bg: '#cffafe', border: '#67e8f9', label: 'Tr' },
  'Holiday':              { color: '#b45309', bg: '#fef3c7', border: '#fcd34d', label: 'H'  },
  'Public Holiday':       { color: '#6b7280', bg: '#f3f4f6', border: '#d1d5db', label: 'PH' },
  'Training':             { color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd', label: 'Tn' },
  'Personal Appointment': { color: '#be123c', bg: '#ffe4e6', border: '#fca5a5', label: 'PA' },
  'Other':                { color: '#475569', bg: '#f1f5f9', border: '#cbd5e1', label: 'O'  },
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function localDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function getDow(dateStr: string): number {
  return (new Date(dateStr + 'T12:00:00').getDay() + 6) % 7
}

function isWeekend(dateStr: string) {
  return getDow(dateStr) >= 5
}

function monthRange(year: number, month: number) {
  const days: string[] = []
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) days.push(localDate(year, month, d))
  return days
}

function datesBetween(start: string, end: string): string[] {
  const dates: string[] = []
  const d = new Date(start + 'T12:00:00')
  const last = new Date(end + 'T12:00:00')
  if (d > last) return [start]
  while (d <= last) {
    dates.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return dates
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// Panel states
type ViewPanel = { mode: 'view'; assignment: Assignment; personName: string }
type FormPanel = { mode: 'form'; personId: string; personName: string; startDate: string; assignment: Assignment | null }
type PanelState = ViewPanel | FormPanel | null

const emptyForm = (date: string) => ({
  type: 'Work' as string,
  startDate: date,
  endDate: date,
  client: '',
  scope: '',
  location: '',
  notes: '',
})
type FormState = ReturnType<typeof emptyForm>

function fieldStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 13,
    width: '100%',
    outline: 'none',
    ...extra,
  }
}

function PanelView({ panel, canEdit, onEdit, onDelete, onClose, saving }: {
  panel: ViewPanel
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
  saving: boolean
}) {
  const { assignment, personName } = panel
  const cfg = TYPE_CFG[assignment.type as ActivityType]

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {cfg && (
              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontWeight: 700 }}>
                {assignment.type}
              </span>
            )}
          </div>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{personName}</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{formatDate(assignment.date)}</p>
        </div>
        <button onClick={onClose} style={{ padding: 4, borderRadius: 6, color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {assignment.client && (
          <Row label="Client / Project" value={assignment.client} />
        )}
        {assignment.scope && (
          <Row label="Scope" value={assignment.scope} />
        )}
        {assignment.location && (
          <Row label="Location" value={assignment.location} />
        )}
        {assignment.notes && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Notes</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 12px' }}>
              {assignment.notes}
            </p>
          </div>
        )}
        {!assignment.client && !assignment.scope && !assignment.location && !assignment.notes && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>No additional details recorded.</p>
        )}
      </div>

      {canEdit && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onDelete}
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', color: '#ef4444', background: 'transparent', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
            <Trash2 size={13} /> Delete
          </button>
          <button
            onClick={onEdit}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '7px 14px', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            <Pencil size={13} /> Edit
          </button>
        </div>
      )}
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: 110, paddingTop: 1 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{value}</span>
    </div>
  )
}

function PanelForm({ panel, onSave, onClose, saving }: {
  panel: FormPanel
  onSave: (f: FormState) => void
  onClose: () => void
  saving: boolean
}) {
  const isEdit = panel.assignment !== null
  const [form, setForm] = useState<FormState>(() =>
    panel.assignment
      ? {
          type: panel.assignment.type,
          startDate: panel.assignment.date,
          endDate: panel.assignment.date,
          client: panel.assignment.client ?? '',
          scope: panel.assignment.scope ?? '',
          location: panel.assignment.location ?? '',
          notes: panel.assignment.notes ?? '',
        }
      : emptyForm(panel.startDate)
  )

  const set = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }))

  const rangeCount = useMemo(() => {
    if (!form.startDate || !form.endDate) return 1
    return datesBetween(form.startDate, form.endDate).length
  }, [form.startDate, form.endDate])

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {isEdit ? 'Edit assignment' : 'Add assignment'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{panel.personName}</p>
        </div>
        <button onClick={onClose} style={{ padding: 4, borderRadius: 6, color: 'var(--text-muted)', cursor: 'pointer' }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Type */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>
            Activity Type *
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {TYPES.map(t => {
              const cfg = TYPE_CFG[t]
              const selected = form.type === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('type', t)}
                  style={{
                    fontSize: 11,
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: `1px solid ${selected ? cfg.border : 'var(--border)'}`,
                    background: selected ? cfg.bg : 'var(--bg-elevated)',
                    color: selected ? cfg.color : 'var(--text-muted)',
                    fontWeight: selected ? 700 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.1s',
                  }}>
                  {t}
                </button>
              )
            })}
          </div>
        </div>

        {/* Date range */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>
              Start date
            </label>
            <input type="date" style={fieldStyle()} value={form.startDate} onChange={e => {
              set('startDate', e.target.value)
              if (form.endDate < e.target.value) set('endDate', e.target.value)
            }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>
              End date
            </label>
            <input type="date" style={fieldStyle()} value={form.endDate} min={form.startDate} onChange={e => set('endDate', e.target.value)} />
          </div>
        </div>

        {rangeCount > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, background: 'rgba(108,114,245,0.08)', border: '1px solid rgba(108,114,245,0.2)' }}>
            <Calendar size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
              {rangeCount} days will be allocated ({form.startDate} → {form.endDate})
            </span>
          </div>
        )}

        {/* Client */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>
            Client / Project
          </label>
          <input style={fieldStyle()} value={form.client} onChange={e => set('client', e.target.value)} placeholder="e.g. National Grid, Boreas 1…" />
        </div>

        {/* Scope */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>
            Scope / Description
          </label>
          <input style={fieldStyle()} value={form.scope} onChange={e => set('scope', e.target.value)} placeholder="e.g. Protection design, Site survey…" />
        </div>

        {/* Location */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>
            Location
          </label>
          <input style={fieldStyle()} value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Office, Site, Home…" />
        </div>

        {/* Notes */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>
            Notes
          </label>
          <textarea
            style={{ ...fieldStyle(), minHeight: 72, resize: 'vertical' }}
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Any additional info…"
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
        <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--text-muted)', background: 'transparent', cursor: 'pointer' }}>
          <X size={13} /> Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.type}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '8px 16px', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
          <Check size={13} /> {saving ? 'Saving…' : (rangeCount > 1 ? `Save ${rangeCount} days` : 'Save')}
        </button>
      </div>
    </>
  )
}

export default function PersonnelPlanner({ people, initialAssignments, companyId, canEdit = false }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [panel, setPanel] = useState<PanelState>(null)

  const dates = useMemo(() => monthRange(year, month), [year, month])

  const aMap = useMemo(() => {
    const m = new Map<string, Assignment>()
    assignments.forEach(a => m.set(`${a.person_id}:${a.date}`, a))
    return m
  }, [assignments])

  const fetchMonth = useCallback(async (y: number, mo: number) => {
    setLoading(true)
    const from = localDate(y, mo, 1)
    const to = localDate(y, mo, new Date(y, mo + 1, 0).getDate())
    const res = await fetch(`/api/planner?from=${from}&to=${to}`)
    if (res.ok) setAssignments(await res.json())
    setLoading(false)
  }, [])

  function prevMonth() {
    const nm = month === 0 ? 11 : month - 1
    const ny = month === 0 ? year - 1 : year
    setMonth(nm); setYear(ny)
    fetchMonth(ny, nm)
  }

  function nextMonth() {
    const nm = month === 11 ? 0 : month + 1
    const ny = month === 11 ? year + 1 : year
    setMonth(nm); setYear(ny)
    fetchMonth(ny, nm)
  }

  function goToday() {
    const d = new Date()
    setYear(d.getFullYear()); setMonth(d.getMonth())
    fetchMonth(d.getFullYear(), d.getMonth())
  }

  function openCell(person: Person, date: string) {
    const a = aMap.get(`${person.id}:${date}`)
    if (a) {
      setPanel({ mode: 'view', assignment: a, personName: person.name })
    } else if (canEdit) {
      setPanel({ mode: 'form', personId: person.id, personName: person.name, startDate: date, assignment: null })
    }
  }

  function closePanel() { setPanel(null) }

  async function handleSave(form: FormState) {
    if (panel?.mode !== 'form') return
    setSaving(true)
    const dates = datesBetween(form.startDate, form.endDate)
    const saved: Assignment[] = []

    for (const date of dates) {
      const isSingleEdit = dates.length === 1 && panel.assignment?.date === date
      const payload: Record<string, unknown> = {
        person_id: panel.personId,
        person_label: panel.personName,
        date,
        type: form.type,
        client: form.client.trim() || null,
        scope: form.scope.trim() || null,
        location: form.location.trim() || null,
        notes: form.notes.trim() || null,
      }
      if (isSingleEdit && panel.assignment) payload.id = panel.assignment.id

      const res = await fetch('/api/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) saved.push(await res.json())
    }

    setAssignments(prev => {
      const datesToReplace = new Set(dates)
      const kept = prev.filter(a => !(a.person_id === panel.personId && datesToReplace.has(a.date)))
      return [...kept, ...saved]
    })

    setSaving(false)
    setPanel(null)
  }

  async function handleDelete() {
    if (panel?.mode !== 'view') return
    setSaving(true)
    await fetch(`/api/planner/${panel.assignment.id}`, { method: 'DELETE' })
    setAssignments(prev => prev.filter(a => a.id !== panel.assignment.id))
    setSaving(false)
    setPanel(null)
  }

  const monthName = new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  const billableSummary = useMemo(() => {
    const m = new Map<string, number>()
    assignments.forEach(a => {
      if (a.type === 'Work') m.set(a.person_id, (m.get(a.person_id) ?? 0) + 1)
    })
    return m
  }, [assignments])

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={prevMonth} style={navBtnStyle}><ChevronLeft size={14} /></button>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', minWidth: 160, textAlign: 'center' }}>{monthName}</span>
            <button onClick={nextMonth} style={navBtnStyle}><ChevronRight size={14} /></button>
            <button onClick={goToday} style={{ ...navBtnStyle, padding: '5px 12px', fontSize: 12, fontWeight: 600 }}>Today</button>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {TYPES.map(t => {
              const cfg = TYPE_CFG[t]
              return (
                <span key={t} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontWeight: 600 }}>
                  {cfg.label} {t}
                </span>
              )
            })}
          </div>
        </div>

        {/* Grid */}
        <div style={{ position: 'relative' }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(var(--bg-surface-rgb),0.7)', zIndex: 10, borderRadius: 10 }}>
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
            </div>
          )}

          <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', minWidth: `${160 + dates.length * 38}px` }}>

              {/* Left: person column */}
              <div style={{ width: 160, flexShrink: 0, borderRight: '1px solid var(--border)' }}>
                <div style={{ height: 56, background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={12} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Person</span>
                  </div>
                </div>
                {people.map(person => {
                  const billable = billableSummary.get(person.id) ?? 0
                  return (
                    <div key={person.id} style={{ height: 44, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, background: 'var(--bg-surface)' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {person.name[0].toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.name}</p>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {billable > 0 ? `${billable}d billable` : (person.role ?? person.discipline ?? '')}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Right: date columns */}
              <div style={{ flex: 1 }}>
                {/* Date header */}
                <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', height: 56 }}>
                  {dates.map(date => {
                    const dow = getDow(date)
                    const isToday = date === localDate(today.getFullYear(), today.getMonth(), today.getDate())
                    const weekend = isWeekend(date)
                    return (
                      <div key={date} style={{ width: 38, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, borderRight: '1px solid var(--border)', background: weekend ? 'rgba(0,0,0,0.02)' : undefined }}>
                        <span style={{ fontSize: 9, fontWeight: 600, color: weekend ? 'var(--text-muted)' : 'var(--text-secondary)', textTransform: 'uppercase' }}>{WEEKDAYS[dow]}</span>
                        <span style={{
                          fontSize: 12, fontWeight: 700,
                          width: 22, height: 22, borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: isToday ? 'var(--accent)' : 'transparent',
                          color: isToday ? '#fff' : weekend ? 'var(--text-muted)' : 'var(--text-primary)',
                        }}>
                          {parseInt(date.slice(8))}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Person × day cells */}
                {people.map(person => (
                  <div key={person.id} style={{ display: 'flex', height: 44, borderBottom: '1px solid var(--border)' }}>
                    {dates.map(date => {
                      const key = `${person.id}:${date}`
                      const a = aMap.get(key)
                      const cfg = a ? TYPE_CFG[a.type as ActivityType] : null
                      const weekend = isWeekend(date)
                      const isToday = date === localDate(today.getFullYear(), today.getMonth(), today.getDate())
                      const clickable = !!a || canEdit

                      return (
                        <div
                          key={date}
                          onClick={() => openCell(person, date)}
                          title={a
                            ? `${a.type}${a.client ? ` · ${a.client}` : ''}${a.scope ? ` · ${a.scope}` : ''}${a.location ? ` · ${a.location}` : ''}`
                            : canEdit ? 'Click to add' : ''}
                          style={{
                            width: 38,
                            flexShrink: 0,
                            borderRight: '1px solid var(--border)',
                            background: cfg
                              ? cfg.bg
                              : weekend
                                ? 'rgba(0,0,0,0.015)'
                                : 'var(--bg-surface)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: clickable ? 'pointer' : 'default',
                            outline: isToday ? '2px solid var(--accent)' : undefined,
                            outlineOffset: '-2px',
                            transition: 'opacity 0.1s',
                          }}
                          className={clickable ? 'hover:opacity-75' : undefined}
                        >
                          {cfg && (
                            <span style={{ fontSize: 9, fontWeight: 800, color: cfg.color, letterSpacing: '0.02em' }}>
                              {cfg.label}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Billable summary row */}
        {assignments.length > 0 && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {people.map(p => {
              const billable = billableSummary.get(p.id) ?? 0
              const total = assignments.filter(a => a.person_id === p.id).length
              if (!total) return null
              const topClients = [...new Set(assignments.filter(a => a.person_id === p.id && a.client && a.type === 'Work').map(a => a.client!))].slice(0, 3)
              return (
                <div key={p.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', minWidth: 160 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>{p.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{billable} billable · {total - billable} other</p>
                  {topClients.length > 0 && (
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{topClients.join(' · ')}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}

      </div>

      {/* Modal */}
      {panel !== null && (
        <>
          {/* Backdrop */}
          <div
            onClick={closePanel}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 999 }}
          />

          {/* Centered panel */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 1000,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              width: 440,
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: 'calc(100vh - 64px)',
              overflowY: 'auto',
              padding: '20px 24px 24px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
            }}
          >
            {panel.mode === 'view' ? (
              <PanelView
                panel={panel}
                canEdit={canEdit}
                onEdit={() => setPanel({
                  mode: 'form',
                  personId: panel.assignment.person_id,
                  personName: panel.personName,
                  startDate: panel.assignment.date,
                  assignment: panel.assignment,
                })}
                onDelete={handleDelete}
                onClose={closePanel}
                saving={saving}
              />
            ) : (
              <PanelForm
                panel={panel}
                onSave={handleSave}
                onClose={closePanel}
                saving={saving}
              />
            )}
          </div>
        </>
      )}
    </>
  )
}

const navBtnStyle: React.CSSProperties = {
  padding: '5px 7px',
  border: '1px solid var(--border)',
  borderRadius: 7,
  background: 'var(--bg-elevated)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
}
