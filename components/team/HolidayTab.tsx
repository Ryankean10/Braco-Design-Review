'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, Plus, CheckCircle2, XCircle, Clock, Loader2, AlertTriangle, Bell, X } from 'lucide-react'

interface Person {
  id: string; name: string; role: string | null; discipline: string | null
  holiday_allowance: number | null; is_active: boolean
}

interface Appointment {
  id: string; person_id: string; project_id: string | null; site_id: string | null
  project: { id: string; name: string; client: string | null } | null
  site: { id: string; name: string; client: string | null } | null
}

interface HolidayBooking {
  id: string
  person_id: string
  start_date: string
  end_date: string
  days_taken: number
  description: string | null
  status: 'Pending' | 'Approved' | 'Rejected'
  rejection_note: string | null
  approved_by_name: string | null
  approved_at: string | null
}

interface Props {
  people: Person[]
  appointments: Appointment[]
  canManage: boolean
}

const STATUS_CFG = {
  Pending:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.4)',  label: 'Pending'  },
  Approved: { color: '#22c55e', bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.4)',   label: 'Approved' },
  Rejected: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.3)',   label: 'Rejected' },
}

function getMonthDates(year: number, month: number): Date[] {
  const dates: Date[] = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) { dates.push(new Date(d)); d.setDate(d.getDate() + 1) }
  return dates
}

function countWorkingDays(start: string, end: string): number {
  const s = new Date(start), e = new Date(end)
  let count = 0
  const d = new Date(s)
  while (d <= e) { const dow = d.getDay(); if (dow !== 0 && dow !== 6) count++; d.setDate(d.getDate() + 1) }
  return count
}

function datesOverlap(start1: string, end1: string, start2: string, end2: string) {
  return start1 <= end2 && end1 >= start2
}

export default function HolidayTab({ people, appointments, canManage }: Props) {
  const supabase = createClient()
  const now = new Date()
  const [view, setView] = useState<'month' | 'year'>('month')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [bookings, setBookings] = useState<HolidayBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState<{ personId: string; start: string; end: string; description: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [rejectionNote, setRejectionNote] = useState('')
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null)
  const [showApprovals, setShowApprovals] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const activePeople = people.filter(p => p.is_active !== false)
  const pendingCount = bookings.filter(b => b.status === 'Pending').length

  // Group people by their project/site appointment
  const groups = new Map<string, { label: string; people: Person[] }>()
  groups.set('_unallocated', { label: 'Unallocated', people: [] })

  for (const person of activePeople) {
    const appts = appointments.filter(a => a.person_id === person.id)
    if (appts.length === 0) {
      groups.get('_unallocated')!.people.push(person)
    } else {
      for (const appt of appts) {
        const key = appt.site_id ?? appt.project_id ?? '_unallocated'
        const label = appt.site?.name ?? appt.project?.name ?? 'Unknown'
        if (!groups.has(key)) groups.set(key, { label, people: [] })
        if (!groups.get(key)!.people.find(p => p.id === person.id)) {
          groups.get(key)!.people.push(person)
        }
      }
    }
  }

  const fetchBookings = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('holiday_bookings')
      .select('*')
      .in('person_id', activePeople.map(p => p.id))
      .gte('start_date', `${year}-01-01`)
      .lte('end_date', `${year}-12-31`)
      .order('start_date')
    setBookings(data ?? [])
    setLoading(false)
  }, [year, activePeople.map(p => p.id).join(',')])

  useEffect(() => { fetchBookings() }, [fetchBookings])

  function personBookings(personId: string) {
    return bookings.filter(b => b.person_id === personId)
  }

  function approvedDaysUsed(personId: string) {
    return bookings.filter(b => b.person_id === personId && b.status === 'Approved')
      .reduce((s, b) => s + b.days_taken, 0)
  }

  type ClashLevel = 'green' | 'yellow' | 'red'
  interface ClashResult {
    level: ClashLevel
    clashes: { name: string; discipline: string | null; sameType: boolean }[]
  }

  function clashCheck(personId: string, start: string, end: string, excludeId?: string): ClashResult {
    const person = activePeople.find(p => p.id === personId)
    const personDiscipline = person?.discipline ?? null

    const clashes = activePeople
      .filter(p => p.id !== personId)
      .flatMap(p => {
        const overlaps = bookings.some(b =>
          b.person_id === p.id &&
          b.id !== excludeId &&
          b.status !== 'Rejected' &&
          datesOverlap(start, end, b.start_date, b.end_date)
        )
        if (!overlaps) return []
        const sameType = personDiscipline !== null && p.discipline === personDiscipline
        return [{ name: p.name, discipline: p.discipline, sameType }]
      })

    if (clashes.length === 0) return { level: 'green', clashes: [] }
    if (clashes.some(c => c.sameType)) return { level: 'red', clashes }
    return { level: 'yellow', clashes }
  }

  async function submitBooking() {
    if (!booking) return
    setSaving(true)
    const days = countWorkingDays(booking.start, booking.end)
    const res = await fetch('/api/holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId: booking.personId, startDate: booking.start, endDate: booking.end, daysTaken: days, description: booking.description }),
    })
    if (res.ok) { const data = await res.json(); setBookings(prev => [...prev, data.booking]) }
    setSaving(false)
    setBooking(null)
  }

  async function approveBooking(id: string) {
    setActionId(id)
    const res = await fetch(`/api/holidays/${id}/approve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'Approved' }),
    })
    if (res.ok) { const data = await res.json(); setBookings(prev => prev.map(b => b.id === id ? data.booking : b)) }
    setActionId(null)
  }

  async function revokeBooking(id: string) {
    setRevokingId(id)
    const res = await fetch(`/api/holidays/${id}/approve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'Revoked' }),
    })
    if (res.ok) { const data = await res.json(); setBookings(prev => prev.map(b => b.id === id ? data.booking : b)) }
    setRevokingId(null)
  }

  async function rejectBooking(id: string) {
    setActionId(id)
    const res = await fetch(`/api/holidays/${id}/approve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'Rejected', rejectionNote }),
    })
    if (res.ok) { const data = await res.json(); setBookings(prev => prev.map(b => b.id === id ? data.booking : b)) }
    setActionId(null)
    setShowRejectModal(null)
    setRejectionNote('')
  }

  // Month calendar view — one row per person per group
  const monthDates = view === 'month' ? getMonthDates(year, month) : []
  const monthLabel = new Date(year, month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            {(['month', 'year'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="px-3 py-1.5 text-xs font-medium capitalize"
                style={{ background: view === v ? 'var(--accent)' : 'transparent', color: view === v ? '#fff' : 'var(--text-muted)' }}>
                {v}
              </button>
            ))}
          </div>
          {view === 'month' && (
            <>
              <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }}
                className="p-1.5 rounded-lg border hover:opacity-70" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                <ChevronLeft size={14} />
              </button>
              <span className="text-sm font-medium px-1" style={{ color: 'var(--text-primary)' }}>{monthLabel}</span>
              <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }}
                className="p-1.5 rounded-lg border hover:opacity-70" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                <ChevronRight size={14} />
              </button>
            </>
          )}
          {view === 'year' && (
            <>
              <button onClick={() => setYear(y => y - 1)} className="p-1.5 rounded-lg border hover:opacity-70" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}><ChevronLeft size={14} /></button>
              <span className="text-sm font-medium px-1" style={{ color: 'var(--text-primary)' }}>{year}</span>
              <button onClick={() => setYear(y => y + 1)} className="p-1.5 rounded-lg border hover:opacity-70" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}><ChevronRight size={14} /></button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <button onClick={() => setShowApprovals(true)}
              className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all hover:opacity-80"
              style={{
                borderColor: pendingCount > 0 ? 'rgba(245,158,11,0.5)' : 'var(--border)',
                background: pendingCount > 0 ? 'rgba(245,158,11,0.08)' : 'transparent',
                color: pendingCount > 0 ? '#f59e0b' : 'var(--text-muted)',
              }}>
              <Bell size={13} />
              Approvals
              {pendingCount > 0 && (
                <span className="flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold text-white"
                  style={{ background: '#f59e0b' }}>
                  {pendingCount}
                </span>
              )}
            </button>
          )}
          <button onClick={() => setBooking({ personId: activePeople[0]?.id ?? '', start: '', end: '', description: '' })}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white"
            style={{ background: 'var(--accent)' }}>
            <Plus size={13} /> Book holiday
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
      ) : (
        <>
          {/* Month view */}
          {view === 'month' && (
            <div className="space-y-6">
              {[...groups.entries()].filter(([, g]) => g.people.length > 0).map(([key, group]) => (
                <div key={key} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                  <div className="px-4 py-2.5 border-b" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                    <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{group.label}</p>
                  </div>
                  {/* Calendar header */}
                  <div className="overflow-x-auto">
                    <div style={{ minWidth: `${160 + monthDates.length * 28}px` }}>
                      <div className="flex border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
                        <div className="w-40 shrink-0 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Person</div>
                        {monthDates.map(d => {
                          const dow = d.getDay()
                          const isWeekend = dow === 0 || dow === 6
                          return (
                            <div key={d.toISOString()} className="flex-1 text-center text-[9px] py-1.5"
                              style={{ minWidth: 28, color: isWeekend ? 'var(--text-muted)' : 'var(--text-primary)', opacity: isWeekend ? 0.4 : 1, fontWeight: d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() ? 700 : 400 }}>
                              {d.getDate()}
                            </div>
                          )
                        })}
                        <div className="w-20 shrink-0 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-right" style={{ color: 'var(--text-muted)' }}>Used/Total</div>
                      </div>

                      {/* People rows */}
                      {group.people.map(person => {
                        const pb = personBookings(person.id).filter(b =>
                          datesOverlap(b.start_date, b.end_date, `${year}-${String(month + 1).padStart(2, '0')}-01`, `${year}-${String(month + 1).padStart(2, '0')}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`)
                        )
                        const used = approvedDaysUsed(person.id)
                        const total = person.holiday_allowance ?? 28
                        const remaining = total - used

                        return (
                          <div key={person.id} className="flex border-b last:border-b-0 items-center" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
                            <div className="w-40 shrink-0 px-3 py-2">
                              <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{person.name}</p>
                              <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{person.role ?? ''}</p>
                            </div>
                            {monthDates.map(d => {
                              const dateStr = d.toISOString().slice(0, 10)
                              const dow = d.getDay()
                              const isWeekend = dow === 0 || dow === 6
                              const bkg = pb.find(b => dateStr >= b.start_date && dateStr <= b.end_date)
                              const cfg = bkg ? STATUS_CFG[bkg.status] : null
                              return (
                                <div key={dateStr} className="flex-1 flex items-center justify-center py-2"
                                  style={{ minWidth: 28, background: isWeekend ? 'rgba(100,116,139,0.04)' : 'transparent' }}>
                                  {cfg && (
                                    <div className="w-5 h-5 rounded-sm" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                                      title={`${bkg!.status}${bkg!.rejection_note ? ` — ${bkg!.rejection_note}` : ''}${bkg!.description ? ` (${bkg!.description})` : ''}`} />
                                  )}
                                </div>
                              )
                            })}
                            <div className="w-20 shrink-0 px-2 text-right">
                              <span className="text-xs font-medium" style={{ color: remaining < 5 ? '#ef4444' : 'var(--text-primary)' }}>{used}/{total}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Clash warnings */}
                  {(() => {
                    const clashes: string[] = []
                    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`
                    const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`
                    const groupBookings = group.people.flatMap(p =>
                      bookings.filter(b => b.person_id === p.id && b.status !== 'Rejected' && datesOverlap(b.start_date, b.end_date, monthStart, monthEnd))
                        .map(b => ({ ...b, personName: p.name }))
                    )
                    for (let i = 0; i < groupBookings.length; i++) {
                      for (let j = i + 1; j < groupBookings.length; j++) {
                        const a = groupBookings[i], b = groupBookings[j]
                        if (datesOverlap(a.start_date, a.end_date, b.start_date, b.end_date)) {
                          clashes.push(`${a.personName} & ${b.personName} overlap`)
                        }
                      }
                    }
                    if (clashes.length === 0) return null
                    return (
                      <div className="px-4 py-2 border-t flex items-start gap-2" style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.06)' }}>
                        <AlertTriangle size={13} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                        <p className="text-xs" style={{ color: '#f59e0b' }}>Holiday clash: {clashes.join('; ')}</p>
                      </div>
                    )
                  })()}
                </div>
              ))}
            </div>
          )}

          {/* Year view — list of all bookings */}
          {view === 'year' && (
            <div className="space-y-3">
              {[...groups.entries()].filter(([, g]) => g.people.length > 0).map(([key, group]) => (
                <div key={key} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                  <div className="px-4 py-2.5 border-b" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                    <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{group.label}</p>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {group.people.map(person => {
                      const pb = personBookings(person.id)
                      const used = approvedDaysUsed(person.id)
                      const total = person.holiday_allowance ?? 28
                      return (
                        <div key={person.id} className="px-4 py-3" style={{ background: 'var(--bg-surface)' }}>
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{person.name}</span>
                              <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>{used}/{total} days used</span>
                            </div>
                            <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (used / total) * 100)}%`, background: used > total * 0.8 ? '#ef4444' : '#22c55e' }} />
                            </div>
                          </div>
                          {pb.length === 0 ? (
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No holidays booked</p>
                          ) : (
                            <div className="space-y-1.5">
                              {pb.map(b => {
                                const cfg = STATUS_CFG[b.status]
                                return (
                                  <div key={b.id} className="flex items-center justify-between rounded-lg px-3 py-1.5"
                                    style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium" style={{ color: cfg.color }}>
                                        {new Date(b.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                        {b.start_date !== b.end_date && ` – ${new Date(b.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                                      </span>
                                      <span className="text-[10px]" style={{ color: cfg.color }}>{b.days_taken}d</span>
                                      {b.description && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{b.description}</span>}
                                      {b.status === 'Rejected' && b.rejection_note && (
                                        <span className="text-[10px]" style={{ color: '#ef4444' }}>— {b.rejection_note}</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                        style={{ background: cfg.bg, color: cfg.color }}>
                                        {b.status}
                                      </span>
                                      {canManage && b.status === 'Pending' && (
                                        <>
                                          <button onClick={() => approveBooking(b.id)} disabled={actionId === b.id}
                                            className="p-1 rounded hover:opacity-70" title="Approve">
                                            <CheckCircle2 size={14} style={{ color: '#22c55e' }} />
                                          </button>
                                          <button onClick={() => setShowRejectModal(b.id)} title="Reject"
                                            className="p-1 rounded hover:opacity-70">
                                            <XCircle size={14} style={{ color: '#ef4444' }} />
                                          </button>
                                        </>
                                      )}
                                      {canManage && b.status === 'Approved' && (
                                        <button onClick={() => revokeBooking(b.id)} disabled={revokingId === b.id}
                                          className="p-1 rounded hover:opacity-70" title="Remove approval (admin only)">
                                          {revokingId === b.id
                                            ? <Loader2 size={13} className="animate-spin" style={{ color: '#f59e0b' }} />
                                            : <XCircle size={14} style={{ color: '#f59e0b' }} />}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 pt-1">
        {Object.entries(STATUS_CFG).map(([status, cfg]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }} />
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{cfg.label}</span>
          </div>
        ))}
      </div>

      {/* Book holiday modal */}
      {booking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-sm rounded-2xl border p-6 space-y-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Book holiday</h3>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Person</label>
              <select value={booking.personId} onChange={e => setBooking(b => b ? { ...b, personId: e.target.value } : b)}
                className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                {activePeople.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Start date</label>
                <input type="date" value={booking.start} onChange={e => setBooking(b => b ? { ...b, start: e.target.value } : b)}
                  className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>End date</label>
                <input type="date" value={booking.end} onChange={e => setBooking(b => b ? { ...b, end: e.target.value } : b)}
                  min={booking.start}
                  className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
            </div>
            {booking.start && booking.end && (
              <>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {countWorkingDays(booking.start, booking.end)} working day(s)
                </p>
                {(() => {
                  const { level, clashes } = clashCheck(booking.personId, booking.start, booking.end)
                  const clashCfg = {
                    green:  { bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.3)',   color: '#22c55e', label: 'No clashes' },
                    yellow: { bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.35)', color: '#f59e0b', label: 'Cover clash' },
                    red:    { bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.35)',  color: '#ef4444', label: 'Same role clash' },
                  }[level]
                  return (
                    <div className="flex items-start gap-2 rounded-lg p-2.5"
                      style={{ background: clashCfg.bg, border: `1px solid ${clashCfg.border}` }}>
                      <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: clashCfg.color }} />
                      <div>
                        <p className="text-xs font-medium" style={{ color: clashCfg.color }}>{clashCfg.label}</p>
                        {clashes.length > 0 && (
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {clashes.map(c => `${c.name}${c.discipline ? ` (${c.discipline})` : ''}`).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </>
            )}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Notes (optional)</label>
              <input type="text" value={booking.description} onChange={e => setBooking(b => b ? { ...b, description: e.target.value } : b)}
                placeholder="e.g. Annual leave"
                className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setBooking(null)} className="px-3 py-2 rounded-lg text-xs border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Cancel</button>
              <button onClick={submitBooking} disabled={saving || !booking.start || !booking.end || !booking.personId}
                className="px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                style={{ background: 'var(--accent)' }}>
                {saving ? <Loader2 size={13} className="animate-spin" /> : 'Submit request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approvals panel */}
      {showApprovals && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-lg rounded-2xl border flex flex-col" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', maxHeight: '85vh' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Holiday approvals</h3>
                {pendingCount > 0 && (
                  <span className="flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                    style={{ background: '#f59e0b' }}>
                    {pendingCount} pending
                  </span>
                )}
              </div>
              <button onClick={() => setShowApprovals(false)} className="p-1 rounded hover:opacity-70">
                <X size={16} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-3">
              {/* Approved bookings that can be revoked */}
              {bookings.filter(b => b.status === 'Approved').length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Approved — click to remove
                  </p>
                  {bookings.filter(b => b.status === 'Approved')
                    .sort((a, b) => a.start_date.localeCompare(b.start_date))
                    .map(b => {
                      const person = activePeople.find(p => p.id === b.person_id)
                      return (
                        <div key={b.id} className="flex items-center justify-between rounded-lg px-3 py-2 gap-3"
                          style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
                          <div className="min-w-0">
                            <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{person?.name}</span>
                            <span className="text-xs ml-2" style={{ color: '#22c55e' }}>
                              {new Date(b.start_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                              {b.start_date !== b.end_date && ` – ${new Date(b.end_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                              {' '}({b.days_taken}d)
                            </span>
                          </div>
                          <button onClick={() => revokeBooking(b.id)} disabled={revokingId === b.id}
                            className="shrink-0 flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium hover:opacity-80"
                            style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                            {revokingId === b.id ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
                            Remove
                          </button>
                        </div>
                      )
                    })}
                  <div className="border-t pt-2" style={{ borderColor: 'var(--border)' }} />
                </div>
              )}

              {bookings.filter(b => b.status === 'Pending').length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 size={28} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No pending requests</p>
                </div>
              ) : (
                bookings
                  .filter(b => b.status === 'Pending')
                  .sort((a, b) => a.start_date.localeCompare(b.start_date))
                  .map(b => {
                    const person = activePeople.find(p => p.id === b.person_id)
                    const clashResult = clashCheck(b.person_id, b.start_date, b.end_date, b.id)
                    const used = approvedDaysUsed(b.person_id)
                    const total = person?.holiday_allowance ?? 28
                    const remaining = total - used
                    return (
                      <div key={b.id} className="rounded-xl border p-4 space-y-3"
                        style={{ borderColor: 'rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.04)' }}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                              {person?.name ?? 'Unknown'}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                              {person?.role ?? ''}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold" style={{ color: '#f59e0b' }}>
                              {new Date(b.start_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                              {b.start_date !== b.end_date && ` – ${new Date(b.end_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{b.days_taken} working day{b.days_taken !== 1 ? 's' : ''}</p>
                          </div>
                        </div>

                        {b.description && (
                          <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>{b.description}</p>
                        )}

                        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                          <span>{remaining} days remaining of {total} allowance</span>
                          {remaining < b.days_taken && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                              style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                              Exceeds allowance
                            </span>
                          )}
                        </div>

                        {clashResult.level !== 'green' && (() => {
                          const cfg = clashResult.level === 'red'
                            ? { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', color: '#ef4444', label: 'Same role clash' }
                            : { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', color: '#f59e0b', label: 'Cover clash' }
                          return (
                            <div className="flex items-start gap-1.5 rounded-lg px-3 py-2"
                              style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                              <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: cfg.color }} />
                              <div>
                                <p className="text-xs font-medium" style={{ color: cfg.color }}>{cfg.label}</p>
                                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                  {clashResult.clashes.map(c => `${c.name}${c.discipline ? ` (${c.discipline})` : ''}`).join(', ')}
                                </p>
                              </div>
                            </div>
                          )
                        })()}

                        <div className="flex gap-2 pt-1">
                          <button onClick={() => approveBooking(b.id)} disabled={actionId === b.id}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-50"
                            style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
                            {actionId === b.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={13} />}
                            Approve
                          </button>
                          <button onClick={() => { setShowApprovals(false); setShowRejectModal(b.id) }}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                            <XCircle size={13} /> Reject
                          </button>
                        </div>
                      </div>
                    )
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-sm rounded-2xl border p-6 space-y-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Reject holiday request</h3>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Reason (required — stays visible on calendar)</label>
              <textarea value={rejectionNote} onChange={e => setRejectionNote(e.target.value)} rows={3}
                className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none resize-none"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                placeholder="Reason for rejection…" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowRejectModal(null); setRejectionNote('') }}
                className="px-3 py-2 rounded-lg text-xs border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Cancel</button>
              <button onClick={() => rejectBooking(showRejectModal!)} disabled={!rejectionNote.trim() || !!actionId}
                className="px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{ background: '#ef4444' }}>
                {actionId ? <Loader2 size={13} className="animate-spin" /> : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
