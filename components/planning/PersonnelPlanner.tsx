'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, X, Loader2, Trash2, Users } from 'lucide-react'

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
  canEdit: boolean
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
  // Returns 0=Mon … 6=Sun
  const d = new Date(dateStr + 'T12:00:00')
  return (d.getDay() + 6) % 7
}

function isWeekend(dateStr: string) {
  const dow = getDow(dateStr)
  return dow >= 5
}

function fmt(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function monthRange(year: number, month: number) {
  const days: string[] = []
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) days.push(localDate(year, month, d))
  return days
}

const DEFAULT_FORM = { type: 'Work' as ActivityType, client: '', scope: '', location: '', notes: '' }

export default function PersonnelPlanner({ people, initialAssignments, companyId, canEdit }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments)
  const [loading, setLoading] = useState(false)
  const [panel, setPanel] = useState<{ personId: string; date: string } | null>(null)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (panel && canEdit) {
      if (!dialog.open) dialog.showModal()
    } else {
      if (dialog.open) dialog.close()
    }
  }, [panel, canEdit])

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
    if (res.ok) {
      const data: Assignment[] = await res.json()
      setAssignments(data)
    }
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

  function openCell(personId: string, date: string) {
    if (!canEdit) return
    const existing = aMap.get(`${personId}:${date}`)
    setPanel({ personId, date })
    setForm(existing
      ? { type: existing.type as ActivityType, client: existing.client ?? '', scope: existing.scope ?? '', location: existing.location ?? '', notes: existing.notes ?? '' }
      : DEFAULT_FORM
    )
  }

  async function save() {
    if (!panel) return
    setSaving(true)
    const person = people.find(p => p.id === panel.personId)
    const existing = aMap.get(`${panel.personId}:${panel.date}`)
    const payload = {
      id: existing?.id,
      person_id: panel.personId,
      person_label: person?.name ?? 'Unknown',
      date: panel.date,
      ...form,
    }
    const res = await fetch('/api/planner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const saved: Assignment = await res.json()
      setAssignments(prev => {
        const filtered = prev.filter(a => a.id !== saved.id)
        return [...filtered, saved]
      })
      setPanel(null)
    }
    setSaving(false)
  }

  async function del() {
    if (!panel) return
    const existing = aMap.get(`${panel.personId}:${panel.date}`)
    if (!existing) { setPanel(null); return }
    setDeleting(true)
    const res = await fetch(`/api/planner/${existing.id}`, { method: 'DELETE' })
    if (res.ok) {
      setAssignments(prev => prev.filter(a => a.id !== existing.id))
      setPanel(null)
    }
    setDeleting(false)
  }

  const monthName = new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  // Group dates into weeks for the header
  const weeks: { label: string; dates: string[] }[] = []
  let currentWeek: string[] = []
  dates.forEach(d => {
    currentWeek.push(d)
    if (getDow(d) === 6 || d === dates[dates.length - 1]) {
      const first = currentWeek[0]
      const last = currentWeek[currentWeek.length - 1]
      const weekNum = Math.ceil(new Date(d + 'T12:00:00').getDate() / 7)
      weeks.push({ label: `w/c ${new Date(first + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`, dates: [...currentWeek] })
      currentWeek = []
    }
  })

  // Summary: billable days per person (Work days this month)
  const billableSummary = useMemo(() => {
    const m = new Map<string, number>()
    assignments.forEach(a => {
      if (a.type === 'Work') m.set(a.person_id, (m.get(a.person_id) ?? 0) + 1)
    })
    return m
  }, [assignments])

  const panelAssignment = panel ? aMap.get(`${panel.personId}:${panel.date}`) : null

  return (
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
              {/* Month header */}
              <div style={{ height: 56, background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users size={12} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                    Person
                  </span>
                </div>
              </div>
              {/* Person rows */}
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
                    const isSelected = panel?.personId === person.id && panel?.date === date
                    const isToday = date === localDate(today.getFullYear(), today.getMonth(), today.getDate())

                    return (
                      <div
                        key={date}
                        onClick={() => openCell(person.id, date)}
                        title={a ? `${a.type}${a.client ? ` · ${a.client}` : ''}${a.location ? ` · ${a.location}` : ''}` : canEdit ? 'Click to assign' : ''}
                        style={{
                          width: 38,
                          flexShrink: 0,
                          borderRight: '1px solid var(--border)',
                          background: isSelected
                            ? 'rgba(var(--accent-rgb),0.15)'
                            : cfg
                              ? cfg.bg
                              : weekend
                                ? 'rgba(0,0,0,0.015)'
                                : 'var(--bg-surface)',
                          cursor: canEdit ? 'pointer' : 'default',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'opacity 0.1s',
                          outline: isToday && !isSelected ? '2px solid var(--accent)' : undefined,
                          outlineOffset: '-2px',
                        }}
                        onMouseEnter={e => { if (canEdit && !a) (e.currentTarget as HTMLElement).style.background = 'rgba(var(--accent-rgb),0.06)' }}
                        onMouseLeave={e => { if (!a && !isSelected) (e.currentTarget as HTMLElement).style.background = weekend ? 'rgba(0,0,0,0.015)' : 'var(--bg-surface)' }}
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

      {/* Assignment panel — native <dialog> renders in browser top layer, immune to all CSS transforms / stacking */}
      <dialog
        ref={dialogRef}
        onClose={() => setPanel(null)}
        style={{
          width: 360,
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflowY: 'auto',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 20,
          background: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {panel && canEdit && (
          <div style={{ display: 'contents' }}>
            {/* Panel header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {people.find(p => p.id === panel.personId)?.name}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmt(panel.date)}</p>
              </div>
              <button onClick={() => setPanel(null)} style={{ padding: 4, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            {/* Activity type picker */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {TYPES.map(t => {
                  const cfg = TYPE_CFG[t]
                  const sel = form.type === t
                  return (
                    <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))} style={{
                      padding: '4px 10px', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      background: sel ? cfg.bg : 'var(--bg-elevated)',
                      color: sel ? cfg.color : 'var(--text-secondary)',
                      border: sel ? `1.5px solid ${cfg.border}` : '1.5px solid var(--border)',
                    }}>
                      {t}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Fields */}
            {(['client', 'scope', 'location', 'notes'] as const).map(field => (
              <div key={field}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {field.charAt(0).toUpperCase() + field.slice(1)}
                </p>
                <input
                  value={form[field]}
                  onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  placeholder={field === 'client' ? 'e.g. Ventus Energy' : field === 'location' ? 'e.g. Beatrice Offshore' : ''}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
                />
              </div>
            ))}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
              <button
                onClick={save}
                disabled={saving}
                style={{ flex: 1, padding: '9px 0', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {saving ? <Loader2 size={13} className="animate-spin" /> : null}
                Save
              </button>
              {panelAssignment && (
                <button
                  onClick={del}
                  disabled={deleting}
                  style={{ padding: '9px 14px', background: 'none', color: '#ef4444', border: '1px solid #ef4444', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
              )}
            </div>
          </div>
        )}
      </dialog>
    </div>
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
