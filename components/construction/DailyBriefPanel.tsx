'use client'

import { useState, useEffect } from 'react'
import { Loader2, RefreshCw, Users, CloudSun, Wrench, AlertTriangle, ShieldCheck, Building2, ChevronDown, Save, Zap } from 'lucide-react'

interface Personnel { name: string; role: string; company: string; is_manager: boolean }
interface Issue { description: string; impact: string; owner: string; action: string; status: string }
interface Weather { description: string; temp_max_c: number; temp_min_c: number; wind_speed_kmh: number; precipitation_mm: number; geocoded_location: string }

interface DailyBrief {
  id: string
  brief_date: string
  planned_works: string | null
  rams_notes: string | null
  third_parties: string | null
  personnel_on_site: Personnel[]
  holiday_absences: { name: string }[]
  issues_carried_over: Issue[]
  weather: Weather | null
  hs_fact: string | null
  ai_summary: string | null
  status: 'draft' | 'sent'
  email_sent_at: string | null
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <button className="w-full flex items-center justify-between px-4 py-3"
        style={{ background: 'var(--bg-elevated)' }}
        onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {icon}{title}
        </div>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
      </button>
      {open && <div className="px-4 py-4" style={{ background: 'var(--bg-surface)' }}>{children}</div>}
    </div>
  )
}

export default function DailyBriefPanel({ siteId }: { siteId: string }) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [brief, setBrief] = useState<DailyBrief | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)

  // Editable fields
  const [plannedWorks, setPlannedWorks] = useState('')
  const [ramsNotes, setRamsNotes] = useState('')
  const [thirdParties, setThirdParties] = useState('')
  const [dirty, setDirty] = useState(false)

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/construction/${siteId}/daily-brief?date=${date}`)
    const data = res.ok ? await res.json() : null
    setBrief(data)
    if (data) {
      setPlannedWorks(data.planned_works ?? '')
      setRamsNotes(data.rams_notes ?? '')
      setThirdParties(data.third_parties ?? '')
    }
    setDirty(false)
    setLoading(false)
  }

  useEffect(() => { load() }, [date])

  async function generate() {
    setGenerating(true)
    const res = await fetch(`/api/construction/${siteId}/daily-brief`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, plannedWorks, ramsNotes, thirdParties }),
    })
    if (res.ok) {
      const data = await res.json()
      setBrief(data)
      setPlannedWorks(data.planned_works ?? '')
      setRamsNotes(data.rams_notes ?? '')
      setThirdParties(data.third_parties ?? '')
      setDirty(false)
    }
    setGenerating(false)
  }

  async function save() {
    if (!brief) return
    setSaving(true)
    await fetch(`/api/construction/${siteId}/daily-brief`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, plannedWorks, ramsNotes, thirdParties }),
    })
    setDirty(false)
    setSaving(false)
  }

  const inputStyle = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '13px',
    padding: '8px 12px',
    width: '100%',
    resize: 'vertical' as const,
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="px-3 py-1.5 rounded-lg border text-sm"
          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />

        {dirty && brief && (
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save changes
          </button>
        )}

        <button onClick={generate} disabled={generating}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium ml-auto"
          style={{ background: 'var(--accent)', color: '#fff', opacity: generating ? 0.6 : 1 }}>
          {generating ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          {brief ? 'Regenerate brief' : 'Generate brief'}
        </button>

        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Pre-fill inputs (shown always so manager can fill before generating) */}
      <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Brief inputs (fill before generating)</p>

        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Planned works today</label>
          <textarea rows={3} value={plannedWorks} style={inputStyle}
            placeholder="Describe today's planned activities on site…"
            onChange={e => { setPlannedWorks(e.target.value); setDirty(true) }} />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>3rd parties / visitors expected</label>
          <textarea rows={2} value={thirdParties} style={inputStyle}
            placeholder="e.g. DNO inspector 10:00, concrete supplier delivery 08:00…"
            onChange={e => { setThirdParties(e.target.value); setDirty(true) }} />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>RAMS / method statement notes</label>
          <textarea rows={2} value={ramsNotes} style={inputStyle}
            placeholder="Relevant risk assessment or method statement references…"
            onChange={e => { setRamsNotes(e.target.value); setDirty(true) }} />
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      )}

      {!loading && !brief && (
        <div className="text-center py-12 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
          <Zap size={28} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No brief generated for {date} yet.</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Fill in the planned works above then click Generate.</p>
        </div>
      )}

      {!loading && brief && (
        <>
          {/* Status bar */}
          <div className="flex items-center gap-3 px-4 py-2 rounded-lg text-xs" style={{
            background: brief.status === 'sent' ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)',
            border: `1px solid ${brief.status === 'sent' ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`,
            color: brief.status === 'sent' ? '#22c55e' : '#f59e0b',
          }}>
            {brief.status === 'sent'
              ? `✓ Emailed to managers at ${brief.email_sent_at ? new Date(brief.email_sent_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}`
              : '⏳ Draft — will be emailed at 05:30'}
          </div>

          {/* AI summary */}
          {brief.ai_summary && (
            <div className="px-4 py-3 rounded-xl text-sm leading-relaxed"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              {brief.ai_summary}
            </div>
          )}

          {/* Weather */}
          {brief.weather && (
            <Section icon={<CloudSun size={15} />} title="Weather Forecast">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Conditions', value: brief.weather.description },
                  { label: 'Temperature', value: `${brief.weather.temp_min_c}–${brief.weather.temp_max_c}°C` },
                  { label: 'Wind', value: `${brief.weather.wind_speed_kmh} km/h` },
                  { label: 'Rainfall', value: `${brief.weather.precipitation_mm} mm` },
                ].map(s => (
                  <div key={s.label} className="rounded-lg px-3 py-2 text-center"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
                    <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
                  </div>
                ))}
              </div>
              {brief.weather.geocoded_location && (
                <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>Location: {brief.weather.geocoded_location}</p>
              )}
            </Section>
          )}

          {/* Personnel */}
          <Section icon={<Users size={15} />} title={`Personnel On Site (${brief.personnel_on_site.length})`}>
            {brief.personnel_on_site.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No appointments confirmed for this date.</p>
            ) : (
              <div className="space-y-1">
                {brief.personnel_on_site.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-elevated)' }}>
                    <div className="flex-1">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                      {p.is_manager && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa' }}>Manager</span>}
                    </div>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.role}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.company}</span>
                  </div>
                ))}
              </div>
            )}
            {brief.holiday_absences.length > 0 && (
              <div className="mt-3 px-3 py-2 rounded-lg text-xs"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}>
                ⚠ Absent (approved leave): {brief.holiday_absences.map(p => p.name).join(', ')}
              </div>
            )}
          </Section>

          {/* 3rd parties */}
          {brief.third_parties && (
            <Section icon={<Building2 size={15} />} title="3rd Parties / Visitors">
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{brief.third_parties}</p>
            </Section>
          )}

          {/* Planned works */}
          <Section icon={<Wrench size={15} />} title="Planned Works Today">
            <p className="text-sm" style={{ color: brief.planned_works ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {brief.planned_works || 'Not specified'}
            </p>
            {brief.rams_notes && (
              <div className="mt-3 px-3 py-2 rounded-lg text-xs"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>RAMS notes:</strong> {brief.rams_notes}
              </div>
            )}
          </Section>

          {/* Issues carried over */}
          {brief.issues_carried_over.length > 0 && (
            <Section icon={<AlertTriangle size={15} />} title={`Issues Carried Over (${brief.issues_carried_over.length})`}>
              <div className="space-y-2">
                {brief.issues_carried_over.map((issue, i) => (
                  <div key={i} className="px-3 py-2 rounded-lg text-xs"
                    style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{issue.description}</p>
                    <p className="mt-1" style={{ color: 'var(--text-muted)' }}>Owner: {issue.owner} · Action: {issue.action}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* H&S fact */}
          {brief.hs_fact && (
            <Section icon={<ShieldCheck size={15} />} title="Health & Safety — Today's Reminder">
              <p className="text-sm leading-relaxed" style={{ color: '#86efac' }}>{brief.hs_fact}</p>
            </Section>
          )}
        </>
      )}
    </div>
  )
}
