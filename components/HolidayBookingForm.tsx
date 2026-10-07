'use client'

import { useState, useMemo } from 'react'
import { CalendarDays, Check, ChevronDown } from 'lucide-react'

function countWorkingDays(start: string, end: string): number {
  if (!start || !end) return 0
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  if (e < s) return 0
  let count = 0
  const cur = new Date(s)
  while (cur <= e) {
    const d = cur.getDay()
    if (d !== 0 && d !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

interface Person {
  id: string
  name: string
  email: string | null
}

interface Props {
  companyName: string
  accentColor: string
  people: Person[]
}

type Step = 'form' | 'success'

export default function HolidayBookingForm({ companyName, accentColor, people }: Props) {
  const [step, setStep] = useState<Step>('form')
  const [personId, setPersonId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmedDays, setConfirmedDays] = useState(0)

  const today = new Date().toISOString().slice(0, 10)

  const workingDays = useMemo(() => countWorkingDays(startDate, endDate), [startDate, endDate])

  function handleStartDate(v: string) {
    setStartDate(v)
    if (endDate && endDate < v) setEndDate(v)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!personId || !startDate || !endDate) return
    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch('/api/holiday-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, startDate, endDate, notes }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Something went wrong — please try again.')
        setSubmitting(false)
        return
      }
      setConfirmedDays(json.daysTaken)
      setStep('success')
    } catch {
      setError('Network error — please check your connection and try again.')
      setSubmitting(false)
    }
  }

  const selectedPerson = people.find(p => p.id === personId)

  const inp: React.CSSProperties = {
    width: '100%',
    padding: '0.625rem 0.875rem',
    borderRadius: '0.5rem',
    border: '1px solid #e2e8f0',
    fontSize: '0.9rem',
    color: '#1e293b',
    background: '#fff',
    outline: 'none',
    appearance: 'none' as any,
  }

  if (step === 'success') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '1.5rem' }}>
        <div style={{ textAlign: 'center', maxWidth: 440, width: '100%', background: '#fff', borderRadius: '1rem', padding: '3rem 2rem', boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: `${accentColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
            <Check size={26} style={{ color: accentColor }} />
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>Request submitted</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '0.25rem' }}>
            <strong style={{ color: '#1e293b' }}>{selectedPerson?.name}</strong> — {confirmedDays} working day{confirmedDays !== 1 ? 's' : ''} requested.
          </p>
          <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.75rem' }}>
            Your manager will review and confirm shortly.
          </p>
          <button
            onClick={() => { setStep('form'); setPersonId(''); setStartDate(''); setEndDate(''); setNotes('') }}
            style={{ marginTop: '2rem', padding: '0.625rem 1.5rem', borderRadius: '0.5rem', border: 'none', background: accentColor, color: '#fff', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
          >
            Book another
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ width: 48, height: 48, borderRadius: '0.75rem', background: `${accentColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <CalendarDays size={24} style={{ color: accentColor }} />
          </div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>Holiday Request</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>{companyName}</p>
        </div>

        {/* Card */}
        <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: '1rem', padding: '2rem', boxShadow: '0 4px 24px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Name */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Your name</label>
            <div style={{ position: 'relative' }}>
              <select
                required
                value={personId}
                onChange={e => setPersonId(e.target.value)}
                style={{ ...inp, paddingRight: '2.25rem' }}
              >
                <option value="">Select your name…</option>
                {people.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
            </div>
          </div>

          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>From</label>
              <input
                type="date"
                required
                min={today}
                value={startDate}
                onChange={e => handleStartDate(e.target.value)}
                style={inp}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>To</label>
              <input
                type="date"
                required
                min={startDate || today}
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                style={inp}
              />
            </div>
          </div>

          {/* Working days pill */}
          {workingDays > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.875rem', borderRadius: '0.5rem', background: `${accentColor}10`, border: `1px solid ${accentColor}30` }}>
              <CalendarDays size={14} style={{ color: accentColor, flexShrink: 0 }} />
              <span style={{ fontSize: '0.85rem', color: '#334155' }}>
                <strong style={{ color: accentColor }}>{workingDays}</strong> working day{workingDays !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Notes <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#94a3b8' }}>(optional)</span></label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any additional details…"
              style={{ ...inp, resize: 'vertical', minHeight: 72 }}
            />
          </div>

          {error && (
            <p style={{ fontSize: '0.85rem', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '0.625rem 0.875rem', borderRadius: '0.5rem' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !personId || !startDate || !endDate}
            style={{ padding: '0.75rem', borderRadius: '0.5rem', border: 'none', background: accentColor, color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: submitting ? 'wait' : 'pointer', opacity: (!personId || !startDate || !endDate) ? 0.5 : 1, transition: 'opacity 0.15s' }}
          >
            {submitting ? 'Submitting…' : 'Submit request'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.75rem', color: '#94a3b8' }}>
          Requests are reviewed by your manager — you'll be notified once approved.
        </p>
      </div>
    </div>
  )
}
