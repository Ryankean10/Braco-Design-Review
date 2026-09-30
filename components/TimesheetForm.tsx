'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  companyName: string
  logoUrl: string | null
  accentColor: string
}

interface DayEntry {
  date: string
  hours_on_site: string
  driving_hours: string
  working_location: string
  comments: string
}

const DAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getMondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDay(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function fmtWeekShort(monday: Date): string {
  const sun = new Date(monday); sun.setDate(sun.getDate() + 6)
  return `${monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${sun.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
}

function fmtWeekFull(monday: Date): string {
  const sun = new Date(monday); sun.setDate(sun.getDate() + 6)
  return `${monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${sun.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

function buildWeekDays(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(d.getDate() + i); return localDateStr(d)
  })
}

function emptyDay(date: string): DayEntry {
  return { date, hours_on_site: '', driving_hours: '', working_location: '', comments: '' }
}

export default function TimesheetForm({ companyName, logoUrl, accentColor }: Props) {
  const [step, setStep] = useState<'form' | 'submitting' | 'success' | 'error'>('form')
  const [errorMsg, setErrorMsg] = useState('')
  const [matchedName, setMatchedName] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [monday, setMonday] = useState<Date>(() => getMondayOf(new Date()))
  const [days, setDays] = useState<Record<string, DayEntry>>({})

  const weekDates = buildWeekDays(monday)
  const weekKey = localDateStr(monday)

  function getDay(date: string): DayEntry { return days[date] ?? emptyDay(date) }

  function setDayField(date: string, field: keyof DayEntry, value: string) {
    setDays(prev => ({ ...prev, [date]: { ...getDay(date), date, [field]: value } }))
  }

  function shiftWeek(delta: number) {
    const d = new Date(monday); d.setDate(d.getDate() + delta * 7); setMonday(d)
  }

  // Include any day where the user has entered a value in either field (even 0)
  const activeDays = weekDates.filter(date => {
    const d = getDay(date)
    return d.hours_on_site !== '' || d.driving_hours !== ''
  })
  const totalSiteHours = activeDays.reduce((s, d) => s + (parseFloat(getDay(d).hours_on_site) || 0), 0)
  const totalDriveHours = activeDays.reduce((s, d) => s + (parseFloat(getDay(d).driving_hours) || 0), 0)
  const canSubmit = name.trim() && activeDays.length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setStep('submitting')
    const daysPayload = activeDays.map(date => {
      const d = getDay(date)
      return { date, hours_on_site: parseFloat(d.hours_on_site) || 0, driving_hours: parseFloat(d.driving_hours) || 0, working_location: d.working_location.trim(), comments: d.comments.trim() }
    })
    try {
      const res = await fetch('/api/timesheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submitted_name: name.trim(), week_starting: weekKey, days: daysPayload }),
      })
      const json = await res.json()
      if (!res.ok) { setErrorMsg(json.error ?? 'Submission failed. Please try again.'); setStep('error'); return }
      setMatchedName(json.matchedName ?? null)
      setStep('success')
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.')
      setStep('error')
    }
  }

  // Shared input style — 16px font prevents iOS auto-zoom
  const textInput: React.CSSProperties = {
    width: '100%', padding: '11px 12px', border: '1px solid #d1d5db', borderRadius: 10,
    fontSize: 16, outline: 'none', background: '#fff', color: '#111827', boxSizing: 'border-box',
    WebkitAppearance: 'none',
  }

  return (
    <>
      {/* Prevent horizontal scroll globally on this page */}
      <style>{`html,body{overflow-x:hidden;-webkit-text-size-adjust:100%}`}</style>

      <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: 520 }}>

          {/* Header bar */}
          <div style={{ background: accentColor, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={companyName} style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 8, background: '#fff', padding: 4, flexShrink: 0 }} />
            )}
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>{companyName}</div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>Weekly Timesheet</div>
            </div>
          </div>

          <div style={{ padding: '16px 16px 32px' }}>

            {/* ── Success ── */}
            {step === 'success' && (
              <div style={{ background: '#fff', borderRadius: 14, padding: '32px 24px', textAlign: 'center', marginTop: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
                <h2 style={{ color: '#111827', fontSize: 20, fontWeight: 700, margin: '0 0 10px' }}>Timesheet submitted</h2>
                <p style={{ color: '#6b7280', fontSize: 15, margin: 0, lineHeight: 1.5 }}>
                  Week of {fmtWeekFull(monday)}<br />received and awaiting approval.
                </p>
                {matchedName && (
                  <p style={{ color: '#6b7280', fontSize: 14, marginTop: 10 }}>
                    Logged against <strong>{matchedName}</strong>
                  </p>
                )}
                <button
                  onClick={() => { setName(''); setDays({}); setStep('form') }}
                  style={{ marginTop: 24, padding: '13px 28px', background: accentColor, color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%' }}
                >
                  Submit another week
                </button>
              </div>
            )}

            {/* ── Error ── */}
            {step === 'error' && (
              <div style={{ background: '#fff', borderRadius: 14, padding: '32px 24px', textAlign: 'center', marginTop: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
                <h2 style={{ color: '#111827', fontSize: 18, fontWeight: 700, margin: '0 0 10px' }}>Submission failed</h2>
                <p style={{ color: '#dc2626', fontSize: 15, margin: '0 0 24px' }}>{errorMsg}</p>
                <button onClick={() => setStep('form')} style={{ padding: '13px 28px', background: accentColor, color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
                  Try again
                </button>
              </div>
            )}

            {/* ── Form ── */}
            {(step === 'form' || step === 'submitting') && (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Name card */}
                <div style={{ background: '#fff', borderRadius: 14, padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Your name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. John Smith"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    autoFocus
                    autoComplete="name"
                    style={textInput}
                  />
                </div>

                {/* Week picker card */}
                <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>Week</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => shiftWeek(-1)}
                      style={{ width: 44, height: 44, border: '1px solid #e5e7eb', borderRadius: 10, background: '#f9fafb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    >
                      <ChevronLeft size={18} color="#374151" />
                    </button>

                    <div style={{ textAlign: 'center', flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{fmtWeekShort(monday)}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{monday.getFullYear()}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => shiftWeek(1)}
                      style={{ width: 44, height: 44, border: '1px solid #e5e7eb', borderRadius: 10, background: '#f9fafb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    >
                      <ChevronRight size={18} color="#374151" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setMonday(getMondayOf(new Date())); setDays({}) }}
                    style={{ width: '100%', marginTop: 10, padding: '8px', fontSize: 13, fontWeight: 600, color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', cursor: 'pointer' }}
                  >
                    Jump to this week
                  </button>
                </div>

                {/* Day cards */}
                <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Hours</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Tap a day to enter hours. Leave blank if not worked.</div>
                  </div>

                  {weekDates.map((date, i) => {
                    const d = getDay(date)
                    const siteHrs = parseFloat(d.hours_on_site) || 0
                    const driveHrs = parseFloat(d.driving_hours) || 0
                    const hasHours = d.hours_on_site !== '' || d.driving_hours !== ''
                    const isWeekend = i >= 5

                    return (
                      <div key={date} style={{ borderBottom: i < 6 ? '1px solid #f3f4f6' : undefined }}>
                        {/* Day row — always visible */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: hasHours ? `${accentColor}08` : 'transparent' }}>
                          {/* Day label */}
                          <div style={{ width: 52, flexShrink: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: isWeekend ? '#9ca3af' : '#111827' }}>{DAYS_SHORT[i]}</div>
                            <div style={{ fontSize: 11, color: '#9ca3af' }}>{fmtDay(date)}</div>
                          </div>

                          {/* Hours on site */}
                          <div style={{ flex: 1, textAlign: 'center' }}>
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0" max="24" step="0.5"
                              placeholder="—"
                              value={d.hours_on_site}
                              onChange={e => setDayField(date, 'hours_on_site', e.target.value)}
                              style={{
                                width: '100%', padding: '8px 4px', border: `2px solid ${hasHours ? accentColor : '#e5e7eb'}`,
                                borderRadius: 8, fontSize: 18, fontWeight: 700, textAlign: 'center',
                                color: hasHours ? '#111827' : '#9ca3af', background: '#fff', outline: 'none',
                                WebkitAppearance: 'none', boxSizing: 'border-box',
                              }}
                            />
                            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3, fontWeight: 600, textTransform: 'uppercase' }}>On site</div>
                          </div>

                          {/* Driving hours */}
                          <div style={{ flex: 1, textAlign: 'center' }}>
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0" max="24" step="0.5"
                              placeholder="—"
                              value={d.driving_hours}
                              onChange={e => setDayField(date, 'driving_hours', e.target.value)}
                              style={{
                                width: '100%', padding: '8px 4px', border: `2px solid ${driveHrs > 0 ? '#94a3b8' : '#e5e7eb'}`,
                                borderRadius: 8, fontSize: 18, fontWeight: 700, textAlign: 'center',
                                color: driveHrs > 0 ? '#111827' : '#9ca3af', background: '#fff', outline: 'none',
                                WebkitAppearance: 'none', boxSizing: 'border-box',
                              }}
                            />
                            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3, fontWeight: 600, textTransform: 'uppercase' }}>Driving</div>
                          </div>
                        </div>

                        {/* Expanded details — only when hours > 0 */}
                        {hasHours && (
                          <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <input
                              type="text"
                              placeholder={`${DAYS_LONG[i]} location (e.g. site name)`}
                              value={d.working_location}
                              onChange={e => setDayField(date, 'working_location', e.target.value)}
                              style={{ ...textInput, fontSize: 15, padding: '9px 12px' }}
                            />
                            <input
                              type="text"
                              placeholder="Notes (optional)"
                              value={d.comments}
                              onChange={e => setDayField(date, 'comments', e.target.value)}
                              style={{ ...textInput, fontSize: 15, padding: '9px 12px' }}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Summary */}
                {activeDays.length > 0 && (
                  <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#111827' }}>{activeDays.length}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>DAYS</div>
                    </div>
                    <div style={{ width: 1, background: '#f3f4f6' }} />
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#111827' }}>{totalSiteHours % 1 === 0 ? totalSiteHours : totalSiteHours.toFixed(1)}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>HRS ON SITE</div>
                    </div>
                    <div style={{ width: 1, background: '#f3f4f6' }} />
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#111827' }}>{totalDriveHours % 1 === 0 ? totalDriveHours : totalDriveHours.toFixed(1)}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>HRS DRIVING</div>
                    </div>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={!canSubmit || step === 'submitting'}
                  style={{
                    padding: '15px', background: canSubmit ? accentColor : '#d1d5db', color: '#fff',
                    border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 700,
                    cursor: canSubmit && step !== 'submitting' ? 'pointer' : 'not-allowed',
                    boxShadow: canSubmit ? `0 4px 14px ${accentColor}55` : 'none',
                    transition: 'opacity 0.15s',
                  }}
                >
                  {step === 'submitting'
                    ? 'Submitting…'
                    : activeDays.length > 0
                      ? `Submit ${activeDays.length} day${activeDays.length !== 1 ? 's' : ''} · ${totalSiteHours % 1 === 0 ? totalSiteHours : totalSiteHours.toFixed(1)} hrs`
                      : 'Enter hours above to submit'}
                </button>

              </form>
            )}
          </div>
        </div>

        <p style={{ color: '#94a3b8', fontSize: 12, padding: '0 0 24px', textAlign: 'center' }}>
          {companyName} · Secure submission
        </p>
      </div>
    </>
  )
}
