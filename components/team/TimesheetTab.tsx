'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock, Download, Loader2, AlertCircle, RotateCcw } from 'lucide-react'

interface Person {
  id: string; name: string; role: string | null; discipline: string | null
  standard_rate: number | null; ot_rate_1: number | null; ot_rate_2: number | null
  holiday_allowance: number | null; is_active: boolean
}

interface TimesheetDay {
  id?: string
  work_date: string
  hours_regular: number
  hours_ot1: number
  hours_ot2: number
  description: string
  is_holiday: boolean
}

interface WeeklyTimesheet {
  id: string
  person_id: string
  week_starting: string
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected'
  signed_off_by: string | null
  signed_off_by_name: string | null
  signed_off_at: string | null
  sign_off_notes: string | null
  sign_off_history: SignOffEntry[]
  days: TimesheetDay[]
}

interface SignOffEntry {
  action: string
  status: string
  by_id: string
  by_name: string
  at: string
  notes: string | null
  previous_status: string
}

interface Props {
  people: Person[]
  canSignOff: boolean
  userRole: string
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getMondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function weekDates(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

function fmtWeek(monday: Date): string {
  const end = new Date(monday); end.setDate(end.getDate() + 6)
  return `${monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

function calcPay(days: TimesheetDay[], person: Person): number {
  return days.reduce((sum, d) => {
    if (d.is_holiday) return sum + 10 * (person.standard_rate ?? 0)
    return sum
      + d.hours_regular * (person.standard_rate ?? 0)
      + d.hours_ot1 * (person.ot_rate_1 ?? person.standard_rate ?? 0)
      + d.hours_ot2 * (person.ot_rate_2 ?? person.standard_rate ?? 0)
  }, 0)
}

const STATUS_CFG = {
  Draft:     { label: 'Draft',     color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
  Submitted: { label: 'Submitted', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  Approved:  { label: 'Approved',  color: '#22c55e', bg: 'rgba(34,197,94,0.12)'  },
  Rejected:  { label: 'Rejected',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
}

export default function TimesheetTab({ people, canSignOff, userRole }: Props) {
  const supabase = createClient()
  const [monday, setMonday] = useState<Date>(() => getMondayOf(new Date()))
  const [sheets, setSheets] = useState<Record<string, WeeklyTimesheet>>({})  // keyed by person_id
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [signOffPersonId, setSignOffPersonId] = useState<string | null>(null)
  const [signOffNotes, setSignOffNotes] = useState('')
  const [signOffAction, setSignOffAction] = useState<'Approved' | 'Rejected'>('Approved')
  const [auditPersonId, setAuditPersonId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const dates = weekDates(monday)
  const weekKey = monday.toISOString().slice(0, 10)
  const activePeople = people.filter(p => p.is_active !== false)

  const canOverride = userRole === 'admin' || userRole === 'superadmin'

  const fetchWeek = useCallback(async () => {
    setLoading(true)
    const personIds = activePeople.map(p => p.id)
    if (!personIds.length) { setLoading(false); return }

    const { data: tsRows } = await supabase
      .from('weekly_timesheets')
      .select('*, timesheet_days(*)')
      .in('person_id', personIds)
      .eq('week_starting', weekKey)

    const map: Record<string, WeeklyTimesheet> = {}
    for (const ts of tsRows ?? []) {
      map[ts.person_id] = { ...ts, days: ts.timesheet_days ?? [] }
    }
    setSheets(map)
    setLoading(false)
  }, [weekKey, activePeople.map(p => p.id).join(',')])

  useEffect(() => { fetchWeek() }, [fetchWeek])

  function getSheet(personId: string): WeeklyTimesheet | null {
    return sheets[personId] ?? null
  }

  function getDayEntry(personId: string, date: string): TimesheetDay {
    const sheet = getSheet(personId)
    const existing = sheet?.days.find(d => d.work_date === date)
    return existing ?? { work_date: date, hours_regular: 0, hours_ot1: 0, hours_ot2: 0, description: '', is_holiday: false }
  }

  async function upsertDay(personId: string, date: string, field: string, value: string | number | boolean) {
    const sheet = getSheet(personId)
    // Ensure timesheet exists
    let tsId = sheet?.id
    if (!tsId) {
      const { data } = await supabase.from('weekly_timesheets')
        .upsert({ person_id: personId, week_starting: weekKey, status: 'Draft' }, { onConflict: 'person_id,week_starting' })
        .select().single()
      tsId = data?.id
      if (tsId) setSheets(prev => ({ ...prev, [personId]: { ...data, days: [] } }))
    }
    if (!tsId) return

    const current = getDayEntry(personId, date)
    const updated = { ...current, [field]: value }
    const { data: dayData } = await supabase.from('timesheet_days')
      .upsert({ ...updated, timesheet_id: tsId, work_date: date }, { onConflict: 'timesheet_id,work_date' })
      .select().single()

    setSheets(prev => {
      const ts = prev[personId] ?? { id: tsId!, person_id: personId, week_starting: weekKey, status: 'Draft', signed_off_by: null, signed_off_by_name: null, signed_off_at: null, sign_off_notes: null, sign_off_history: [], days: [] }
      const days = ts.days.filter(d => d.work_date !== date)
      return { ...prev, [personId]: { ...ts, days: [...days, dayData ?? updated] } }
    })
  }

  async function submitTimesheet(personId: string) {
    setSaving(personId)
    const res = await fetch(`/api/timesheets/sign-off`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId, weekStarting: weekKey, action: 'Submitted', notes: '' }),
    })
    if (res.ok) { const data = await res.json(); setSheets(prev => ({ ...prev, [personId]: { ...prev[personId], ...data.timesheet } })) }
    setSaving(null)
  }

  async function doSignOff() {
    if (!signOffPersonId) return
    setSaving(signOffPersonId)
    const res = await fetch(`/api/timesheets/sign-off`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId: signOffPersonId, weekStarting: weekKey, action: signOffAction, notes: signOffNotes }),
    })
    if (res.ok) { const data = await res.json(); setSheets(prev => ({ ...prev, [signOffPersonId]: { ...prev[signOffPersonId], ...data.timesheet } })) }
    setSaving(null)
    setSignOffPersonId(null)
    setSignOffNotes('')
  }

  async function exportPayroll() {
    setExporting(true)
    const res = await fetch(`/api/timesheets/payroll-export?week=${weekKey}`)
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `payroll-${weekKey}.html`; a.click()
      URL.revokeObjectURL(url)
    }
    setExporting(false)
  }

  const approvedCount = activePeople.filter(p => getSheet(p.id)?.status === 'Approved').length

  return (
    <div className="space-y-4">
      {/* Week nav + export */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => { const d = new Date(monday); d.setDate(d.getDate() - 7); setMonday(d) }}
            className="p-1.5 rounded-lg border hover:opacity-70"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <ChevronLeft size={14} />
          </button>
          <span className="text-sm font-medium px-2" style={{ color: 'var(--text-primary)' }}>
            {fmtWeek(monday)}
          </span>
          <button onClick={() => { const d = new Date(monday); d.setDate(d.getDate() + 7); setMonday(d) }}
            className="p-1.5 rounded-lg border hover:opacity-70"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <ChevronRight size={14} />
          </button>
          <button onClick={() => setMonday(getMondayOf(new Date()))}
            className="text-xs px-2.5 py-1 rounded-lg border ml-1 hover:opacity-70"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            This week
          </button>
        </div>
        <button onClick={exportPayroll} disabled={exporting || approvedCount === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-40"
          style={{ background: '#22c55e' }}>
          {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
          Export payroll ({approvedCount} approved)
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {/* Header row */}
          <div className="grid border-b text-xs font-semibold uppercase tracking-wider px-4 py-2"
            style={{ gridTemplateColumns: '200px repeat(7, 1fr) 100px 80px 100px', borderColor: 'var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
            <div>Person</div>
            {dates.map((d, i) => <div key={d} className="text-center">{DAYS[i]}<br /><span className="font-normal">{d.slice(8)}</span></div>)}
            <div className="text-right">Total hrs</div>
            <div className="text-right">Pay</div>
            <div className="text-center">Status</div>
          </div>

          {/* People rows */}
          {activePeople.map(person => {
            const sheet = getSheet(person.id)
            const status = (sheet?.status ?? 'Draft') as keyof typeof STATUS_CFG
            const cfg = STATUS_CFG[status]
            const isLocked = status === 'Approved' && !canOverride
            const isEditable = status === 'Draft' || (status === 'Rejected')
            const expanded = expandedRows.has(person.id)

            const dayEntries = dates.map(d => getDayEntry(person.id, d))
            const totalHrs = dayEntries.reduce((s, d) => s + (d.is_holiday ? 10 : d.hours_regular + d.hours_ot1 + d.hours_ot2), 0)
            const totalPay = calcPay(dayEntries, person)

            return (
              <div key={person.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                {/* Summary row */}
                <div className="grid items-center px-4 py-2.5 hover:opacity-95 cursor-pointer"
                  style={{ gridTemplateColumns: '200px repeat(7, 1fr) 100px 80px 100px', background: 'var(--bg-surface)' }}
                  onClick={() => setExpandedRows(prev => { const s = new Set(prev); s.has(person.id) ? s.delete(person.id) : s.add(person.id); return s })}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ background: 'var(--accent)' }}>
                      {person.name[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{person.name}</p>
                      <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{person.role ?? ''}</p>
                    </div>
                  </div>
                  {dayEntries.map((day, i) => (
                    <div key={dates[i]} className="text-center text-xs" style={{ color: day.is_holiday ? '#f59e0b' : day.hours_regular + day.hours_ot1 + day.hours_ot2 > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {day.is_holiday ? 'HOL' : (day.hours_regular + day.hours_ot1 + day.hours_ot2 || '—')}
                    </div>
                  ))}
                  <div className="text-right text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{totalHrs > 0 ? totalHrs.toFixed(1) : '—'}</div>
                  <div className="text-right text-xs" style={{ color: 'var(--text-muted)' }}>
                    {totalPay > 0 ? `£${totalPay.toFixed(0)}` : '—'}
                  </div>
                  <div className="flex justify-center">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: cfg.bg, color: cfg.color }}>
                      {cfg.label}
                    </span>
                  </div>
                </div>

                {/* Expanded detail */}
                {expanded && (
                  <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
                    {/* Day entry grid */}
                    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
                      {dates.map((date, i) => {
                        const day = getDayEntry(person.id, date)
                        const isWeekend = i >= 5
                        return (
                          <div key={date} className="rounded-lg p-2 border space-y-1.5"
                            style={{ borderColor: day.is_holiday ? 'rgba(245,158,11,0.4)' : 'var(--border)', background: day.is_holiday ? 'rgba(245,158,11,0.06)' : 'var(--bg-surface)', opacity: isWeekend && !day.hours_regular && !day.hours_ot1 && !day.hours_ot2 && !day.is_holiday ? 0.5 : 1 }}>
                            <p className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>{DAYS[i]} {date.slice(8)}</p>

                            {isEditable && (
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input type="checkbox" checked={day.is_holiday}
                                  onChange={e => upsertDay(person.id, date, 'is_holiday', e.target.checked)}
                                  className="rounded" />
                                <span className="text-[10px]" style={{ color: '#f59e0b' }}>Holiday</span>
                              </label>
                            )}

                            {!day.is_holiday && (
                              <>
                                {[
                                  { key: 'hours_regular', label: 'Reg', value: day.hours_regular },
                                  { key: 'hours_ot1', label: 'OT1', value: day.hours_ot1 },
                                  { key: 'hours_ot2', label: 'OT2', value: day.hours_ot2 },
                                ].map(({ key, label, value }) => (
                                  <div key={key} className="flex items-center gap-1">
                                    <span className="text-[10px] w-6 shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
                                    {isEditable ? (
                                      <input type="number" min="0" max="24" step="0.5" value={value || ''}
                                        onChange={e => upsertDay(person.id, date, key, parseFloat(e.target.value) || 0)}
                                        className="w-full rounded px-1 py-0.5 text-xs border text-right focus:outline-none"
                                        style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                                      />
                                    ) : (
                                      <span className="text-xs ml-auto" style={{ color: 'var(--text-primary)' }}>{value || '—'}</span>
                                    )}
                                  </div>
                                ))}
                                {isEditable && (
                                  <input type="text" placeholder="Notes" value={day.description}
                                    onChange={e => upsertDay(person.id, date, 'description', e.target.value)}
                                    className="w-full rounded px-1 py-0.5 text-[10px] border focus:outline-none"
                                    style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                                  />
                                )}
                              </>
                            )}
                            {day.is_holiday && (
                              <p className="text-[10px]" style={{ color: '#f59e0b' }}>10 hrs @ std rate</p>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Sign-off strip */}
                    <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                      <div className="space-y-0.5">
                        {sheet?.signed_off_by_name && (
                          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            Signed off by <span style={{ color: 'var(--text-primary)' }}>{sheet.signed_off_by_name}</span>
                            {sheet.signed_off_at && ` · ${new Date(sheet.signed_off_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
                            {sheet.sign_off_notes && ` — "${sheet.sign_off_notes}"`}
                          </p>
                        )}
                        {(sheet?.sign_off_history?.length ?? 0) > 0 && (
                          <button onClick={() => setAuditPersonId(auditPersonId === person.id ? null : person.id)}
                            className="flex items-center gap-1 text-[10px] hover:underline"
                            style={{ color: 'var(--text-muted)' }}>
                            <RotateCcw size={10} /> View history ({sheet!.sign_off_history.length})
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isEditable && totalHrs > 0 && (
                          <button onClick={() => submitTimesheet(person.id)} disabled={saving === person.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border hover:opacity-80"
                            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                            {saving === person.id ? <Loader2 size={12} className="animate-spin" /> : <Clock size={12} />}
                            Submit for sign-off
                          </button>
                        )}
                        {canSignOff && status === 'Submitted' && (
                          <button onClick={() => { setSignOffPersonId(person.id); setSignOffAction('Approved') }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                            style={{ background: '#22c55e' }}>
                            <CheckCircle2 size={12} /> Approve
                          </button>
                        )}
                        {canSignOff && status === 'Submitted' && (
                          <button onClick={() => { setSignOffPersonId(person.id); setSignOffAction('Rejected') }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                            style={{ background: '#ef4444' }}>
                            <XCircle size={12} /> Reject
                          </button>
                        )}
                        {canOverride && status === 'Approved' && (
                          <button onClick={() => { setSignOffPersonId(person.id); setSignOffAction('Rejected') }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border hover:opacity-80"
                            style={{ borderColor: '#ef4444', color: '#ef4444' }}>
                            <RotateCcw size={12} /> Override approval
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Audit trail */}
                    {auditPersonId === person.id && (sheet?.sign_off_history?.length ?? 0) > 0 && (
                      <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Sign-off history</p>
                        {[...sheet!.sign_off_history].reverse().map((entry, i) => (
                          <div key={i} className="flex items-start gap-3 text-xs">
                            <span className="text-[10px] shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                              {new Date(entry.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <div>
                              <span style={{ color: 'var(--text-primary)' }}>{entry.by_name}</span>
                              <span style={{ color: 'var(--text-muted)' }}> changed </span>
                              <span style={{ color: STATUS_CFG[entry.previous_status as keyof typeof STATUS_CFG]?.color ?? 'var(--text-muted)' }}>{entry.previous_status}</span>
                              <span style={{ color: 'var(--text-muted)' }}> → </span>
                              <span style={{ color: STATUS_CFG[entry.status as keyof typeof STATUS_CFG]?.color ?? 'var(--accent)' }}>{entry.status}</span>
                              {entry.notes && <span style={{ color: 'var(--text-muted)' }}> — "{entry.notes}"</span>}
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

      {/* Sign-off modal */}
      {signOffPersonId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-sm rounded-2xl border p-6 space-y-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {signOffAction === 'Approved' ? 'Approve timesheet' : 'Reject timesheet'}
              {' — '}{activePeople.find(p => p.id === signOffPersonId)?.name}
            </h3>
            {getSheet(signOffPersonId)?.status === 'Approved' && (
              <div className="flex items-start gap-2 rounded-lg p-3" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
                <AlertCircle size={14} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                <p className="text-xs" style={{ color: '#f59e0b' }}>
                  This timesheet is already approved. Overriding it will be recorded in the audit log.
                </p>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Notes {signOffAction === 'Rejected' ? '(required)' : '(optional)'}
              </label>
              <textarea value={signOffNotes} onChange={e => setSignOffNotes(e.target.value)} rows={3}
                className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none resize-none"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                placeholder={signOffAction === 'Rejected' ? 'Reason for rejection…' : 'Optional notes…'}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setSignOffPersonId(null); setSignOffNotes('') }}
                className="px-3 py-2 rounded-lg text-xs border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                Cancel
              </button>
              <button onClick={doSignOff} disabled={saving === signOffPersonId || (signOffAction === 'Rejected' && !signOffNotes.trim())}
                className="px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                style={{ background: signOffAction === 'Approved' ? '#22c55e' : '#ef4444' }}>
                {saving === signOffPersonId ? <Loader2 size={13} className="animate-spin" /> : signOffAction === 'Approved' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
