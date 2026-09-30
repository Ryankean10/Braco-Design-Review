'use client'

import { useState } from 'react'
import Image from 'next/image'

interface Props {
  companyName: string
  logoUrl: string | null
  accentColor: string
}

interface FormData {
  submitted_name: string
  work_date: string
  hours_on_site: string
  driving_hours: string
  working_location: string
  comments: string
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

export default function TimesheetForm({ companyName, logoUrl, accentColor }: Props) {
  const [step, setStep] = useState<'form' | 'submitting' | 'success' | 'error'>('form')
  const [errorMsg, setErrorMsg] = useState('')
  const [matchedName, setMatchedName] = useState<string | null>(null)

  const [form, setForm] = useState<FormData>({
    submitted_name: '',
    work_date: today(),
    hours_on_site: '',
    driving_hours: '',
    working_location: '',
    comments: '',
  })

  function set(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const canSubmit =
    form.submitted_name.trim() &&
    form.work_date &&
    form.hours_on_site !== '' &&
    form.working_location.trim()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setStep('submitting')

    try {
      const res = await fetch('/api/timesheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          hours_on_site: parseFloat(form.hours_on_site) || 0,
          driving_hours: parseFloat(form.driving_hours) || 0,
        }),
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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontSize: 15,
    outline: 'none',
    background: '#fff',
    color: '#111827',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 4,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 540, background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: accentColor, padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 14 }}>
          {logoUrl && (
            <Image src={logoUrl} alt={companyName} width={48} height={48} style={{ borderRadius: 8, background: '#fff', padding: 4 }} />
          )}
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 18, lineHeight: 1.2 }}>{companyName}</div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 }}>Timesheet Submission</div>
          </div>
        </div>

        <div style={{ padding: '28px' }}>
          {/* Success */}
          {step === 'success' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <h2 style={{ color: '#111827', fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>Timesheet submitted</h2>
              <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 4px' }}>
                Thank you — your timesheet has been received and is awaiting approval.
              </p>
              {matchedName && (
                <p style={{ color: '#6b7280', fontSize: 13, margin: '8px 0 0' }}>
                  Logged against: <strong>{matchedName}</strong>
                </p>
              )}
              <button
                onClick={() => { setForm({ submitted_name: '', work_date: today(), hours_on_site: '', driving_hours: '', working_location: '', comments: '' }); setStep('form') }}
                style={{ marginTop: 20, padding: '10px 24px', background: accentColor, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                Submit another
              </button>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
              <h2 style={{ color: '#111827', fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>Submission failed</h2>
              <p style={{ color: '#dc2626', fontSize: 14, margin: '0 0 20px' }}>{errorMsg}</p>
              <button
                onClick={() => setStep('form')}
                style={{ padding: '10px 24px', background: accentColor, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                Try again
              </button>
            </div>
          )}

          {/* Form */}
          {(step === 'form' || step === 'submitting') && (
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Your name *</label>
                  <input
                    style={inputStyle}
                    type="text"
                    placeholder="e.g. John Smith"
                    value={form.submitted_name}
                    onChange={e => set('submitted_name', e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label style={labelStyle}>Work date *</label>
                  <input
                    style={inputStyle}
                    type="date"
                    value={form.work_date}
                    onChange={e => set('work_date', e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Hours on site *</label>
                    <input
                      style={inputStyle}
                      type="number"
                      min="0"
                      max="24"
                      step="0.5"
                      placeholder="e.g. 8"
                      value={form.hours_on_site}
                      onChange={e => set('hours_on_site', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Driving hours</label>
                    <input
                      style={inputStyle}
                      type="number"
                      min="0"
                      max="24"
                      step="0.5"
                      placeholder="e.g. 1.5"
                      value={form.driving_hours}
                      onChange={e => set('driving_hours', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Working location *</label>
                  <input
                    style={inputStyle}
                    type="text"
                    placeholder="e.g. Site name or office"
                    value={form.working_location}
                    onChange={e => set('working_location', e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle}>Comments</label>
                  <textarea
                    style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                    placeholder="Any additional notes…"
                    value={form.comments}
                    onChange={e => set('comments', e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit || step === 'submitting'}
                  style={{
                    padding: '12px',
                    background: canSubmit ? accentColor : '#d1d5db',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: canSubmit && step !== 'submitting' ? 'pointer' : 'not-allowed',
                    transition: 'opacity 0.15s',
                  }}
                >
                  {step === 'submitting' ? 'Submitting…' : 'Submit timesheet'}
                </button>
              </div>
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
