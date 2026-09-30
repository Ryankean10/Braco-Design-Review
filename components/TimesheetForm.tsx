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

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

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
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function fmtWeek(monday: Date): string {
  const sun = new Date(monday)
  sun.setDate(sun.getDate() + 6)
  return `${monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${sun.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

function buildWeekDays(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return localDateStr(d)
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

  function getDay(date: string): DayEntry {
    return days[date] ?? emptyDay(date)
  }

  function setDayField(date: string, field: keyof DayEntry, value: string) {
    setDays(prev => ({ ...prev, [date]: { ...getDay(date), date, [field]: value } }))
  }

  function prevWeek() {
    const d = new Date(monday)
    d.setDate(d.getDate() - 7)
    setMonday(d)
  }

  function nextWeek() {
    const d = new Date(monday)
    d.setDate(d.getDate() + 7)
    setMonday(d)
  }

  const activeDays = weekDates.filter(date => parseFloat(getDay(date).hours_on_site) > 0)
  const canSubmit = name.trim() && activeDays.length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setStep('submitting')

    const daysPayload = activeDays.map(date => {
      const d = getDay(date)
      return {
        date,
        hours_on_site: parseFloat(d.hours_on_site) || 0,
        driving_hours: parseFloat(d.driving_hours) || 0,
        working_location: d.working_location.trim(),
        comments: d.comments.trim(),
      }
    })

    try {
      const res = await fetch('/api/timesheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submitted_name: name.trim(), week_starting: weekKey, days: daysPayload }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json.error ?? 'Submission failed. Please try again.')
        setStep('error')
        return
      }
      setMatchedName(json.matchedName ?? null)
      setStep('success')
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.')
      setStep('error')
    }
  }

  const inputCls = 'w-full px-2 py-1.5 text-sm border rounded-lg outline-none bg-white text-gray-900'
  const inBorderStyle = { borderColor: '#d1d5db' }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 680, background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: accentColor, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={companyName} style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 8, background: '#fff', padding: 4 }} />
          )}
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 17 }}>{companyName}</div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>Weekly Timesheet</div>
          </div>
        </div>

        <div style={{ padding: '24px' }}>
          {/* Success */}
          {step === 'success' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <h2 style={{ color: '#111827', fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>Timesheet submitted</h2>
              <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
                Your timesheet for the week of {fmtWeek(monday)} has been received and is awaiting approval.
              </p>
              {matchedName && (
                <p style={{ color: '#6b7280', fontSize: 13, marginTop: 8 }}>
                  Logged against: <strong>{matchedName}</strong>
                </p>
              )}
              <button
                onClick={() => { setName(''); setDays({}); setStep('form') }}
                style={{ marginTop: 20, padding: '10px 24px', background: accentColor, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                Submit another week
              </button>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
              <h2 style={{ color: '#111827', fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>Submission failed</h2>
              <p style={{ color: '#dc2626', fontSize: 14, marginBottom: 20 }}>{errorMsg}</p>
              <button onClick={() => setStep('form')} style={{ padding: '10px 24px', background: accentColor, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Try again
              </button>
            </div>
          )}

          {/* Form */}
          {(step === 'form' || step === 'submitting') && (
            <form onSubmit={handleSubmit}>
              {/* Name */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  Your name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Smith"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoFocus
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 15, outline: 'none', background: '#fff', color: '#111827', boxSizing: 'border-box' }}
                />
              </div>

              {/* Week picker */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Week
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button type="button" onClick={prevWeek} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, background: '#f9fafb', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <ChevronLeft size={14} color="#374151" />
                  </button>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{fmtWeek(monday)}</span>
                  <button type="button" onClick={nextWeek} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, background: '#f9fafb', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <ChevronRight size={14} color="#374151" />
                  </button>
                  <button type="button" onClick={() => setMonday(getMondayOf(new Date()))} style={{ padding: '6px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, background: '#f9fafb', cursor: 'pointer', color: '#374151' }}>
                    This week
                  </button>
                </div>
              </div>

              {/* Day rows */}
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
                {/* Column headers */}
                <div style={{ display: 'grid', gridTemplateColumns: '72px 80px 80px 1fr 1fr', gap: 6, padding: '8px 12px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Day</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>On site</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Driving</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Location</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Notes</span>
                </div>

                {weekDates.map((date, i) => {
                  const d = getDay(date)
                  const hasHours = parseFloat(d.hours_on_site) > 0
                  const isWeekend = i >= 5
                  return (
                    <div
                      key={date}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '72px 80px 80px 1fr 1fr',
                        gap: 6,
                        padding: '7px 12px',
                        alignItems: 'center',
                        borderBottom: i < 6 ? '1px solid #f3f4f6' : undefined,
                        background: hasHours ? 'rgba(108,114,245,0.03)' : isWeekend ? '#fafafa' : '#fff',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: isWeekend ? '#9ca3af' : '#111827' }}>{DAYS[i]}</span>
                        <span style={{ fontSize: 11, color: '#9ca3af', display: 'block' }}>{fmtDay(date)}</span>
                      </div>
                      <input
                        type="number"
                        min="0" max="24" step="0.5"
                        placeholder="0"
                        value={d.hours_on_site}
                        onChange={e => setDayField(date, 'hours_on_site', e.target.value)}
                        className={inputCls}
                        style={{ ...inBorderStyle, textAlign: 'center' }}
                      />
                      <input
                        type="number"
                        min="0" max="24" step="0.5"
                        placeholder="0"
                        value={d.driving_hours}
                        onChange={e => setDayField(date, 'driving_hours', e.target.value)}
                        className={inputCls}
                        style={{ ...inBorderStyle, textAlign: 'center' }}
                      />
                      <input
                        type="text"
                        placeholder="Site / office"
                        value={d.working_location}
                        onChange={e => setDayField(date, 'working_location', e.target.value)}
                        className={inputCls}
                        style={inBorderStyle}
                      />
                      <input
                        type="text"
                        placeholder="Optional"
                        value={d.comments}
                        onChange={e => setDayField(date, 'comments', e.target.value)}
                        className={inputCls}
                        style={inBorderStyle}
                      />
                    </div>
                  )
                })}
              </div>

              {/* Summary */}
              {activeDays.length > 0 && (
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, padding: '8px 12px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                  {activeDays.length} day{activeDays.length > 1 ? 's' : ''} ·{' '}
                  {activeDays.reduce((s, d) => s + (parseFloat(getDay(d).hours_on_site) || 0), 0).toFixed(1)} hrs on site ·{' '}
                  {activeDays.reduce((s, d) => s + (parseFloat(getDay(d).driving_hours) || 0), 0).toFixed(1)} hrs driving
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit || step === 'submitting'}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: canSubmit ? accentColor : '#d1d5db',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: canSubmit && step !== 'submitting' ? 'pointer' : 'not-allowed',
                }}
              >
                {step === 'submitting' ? 'Submitting…' : `Submit week (${activeDays.length} day${activeDays.length !== 1 ? 's' : ''})`}
              </button>
            </form>
          )}
        </div>
      </div>

      <p style={{ marginTop: 20, color: '#9ca3af', fontSize: 12 }}>
        Powered by {companyName} · Secure submission
      </p>
    </div>
  )
}
