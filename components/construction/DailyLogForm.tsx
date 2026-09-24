'use client'

import { useState } from 'react'
import { Plus, Trash2, Save, Loader2 } from 'lucide-react'

interface PersonnelRow {
  name: string
  role: string
  company: string
  hours: number | ''
  note: string
}

interface IssueRow {
  description: string
  impact: string
  action: string
  status: string
}

interface Props {
  siteId: string
  onSaved?: () => void
}

const ROLES = ['Electrician', 'Apprentice', 'Site Manager', 'Engineer', 'Labourer', 'Other']
const IMPACTS = ['Low', 'Medium', 'High']
const CONDITIONS = ['Good', 'Fair', 'Poor']

export default function DailyLogForm({ siteId, onSaved }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [weatherDesc, setWeatherDesc] = useState('')
  const [weatherCond, setWeatherCond] = useState('Good')
  const [tempC, setTempC] = useState('')
  const [windMph, setWindMph] = useState('')
  const [rainMm, setRainMm] = useState('')
  const [lostHrs, setLostHrs] = useState('')
  const [weatherImpact, setWeatherImpact] = useState('None')
  const [summary, setSummary] = useState('')
  const [personnel, setPersonnel] = useState<PersonnelRow[]>([
    { name: '', role: 'Electrician', company: 'IPE', hours: '', note: '' }
  ])
  const [issues, setIssues] = useState<IssueRow[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [aiFlags, setAiFlags] = useState<string[]>([])

  function addPerson() {
    setPersonnel(p => [...p, { name: '', role: 'Electrician', company: 'IPE', hours: '', note: '' }])
  }
  function removePerson(i: number) {
    setPersonnel(p => p.filter((_, idx) => idx !== i))
  }
  function updatePerson(i: number, field: keyof PersonnelRow, value: any) {
    setPersonnel(p => p.map((row, idx) => idx === i ? { ...row, [field]: value } : row))
  }

  function addIssue() {
    setIssues(is => [...is, { description: '', impact: 'Medium', action: '', status: 'Open' }])
  }
  function removeIssue(i: number) {
    setIssues(is => is.filter((_, idx) => idx !== i))
  }
  function updateIssue(i: number, field: keyof IssueRow, value: string) {
    setIssues(is => is.map((row, idx) => idx === i ? { ...row, [field]: value } : row))
  }

  async function handleSave() {
    if (!date) { setError('Date is required'); return }
    const validPersonnel = personnel.filter(p => p.name.trim())
    const totalManhours = validPersonnel.reduce((s, p) => s + (Number(p.hours) || 0), 0)

    setSaving(true); setError(''); setAiFlags([])
    try {
      const res = await fetch(`/api/construction/sites/${siteId}/daily-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          log_date: date,
          personnel: validPersonnel.map(p => ({
            name: p.name.trim(), role: p.role, company: p.company,
            hours: Number(p.hours) || 0,
            ...(p.note.trim() ? { note: p.note.trim() } : {}),
          })),
          total_manhours: totalManhours,
          weather_description: weatherDesc || null,
          weather_conditions: weatherCond || null,
          temp_c: tempC ? Number(tempC) : null,
          wind_mph: windMph ? Number(windMph) : null,
          rain_mm: rainMm ? Number(rainMm) : null,
          weather_lost_hours: lostHrs ? Number(lostHrs) : 0,
          weather_impact: weatherImpact,
          issues: issues.filter(i => i.description.trim()),
          summary: summary.trim() || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Save failed') }
      const saved = await res.json()
      if (saved.ai_flags?.length) {
        setAiFlags(saved.ai_flags)
        // Brief pause so user sees flags before form closes
        await new Promise(r => setTimeout(r, 2000))
      }
      onSaved?.()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5 text-sm">
      {/* Date */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium w-20 shrink-0" style={{ color: 'var(--text-muted)' }}>Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm"
          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
      </div>

      {/* Weather */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Weather</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="text-[10px] mb-1 block" style={{ color: 'var(--text-muted)' }}>Conditions</label>
            <select value={weatherCond} onChange={e => setWeatherCond(e.target.value)}
              className="w-full border rounded-lg px-2 py-1.5 text-xs"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
              {CONDITIONS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] mb-1 block" style={{ color: 'var(--text-muted)' }}>Temp (°C)</label>
            <input type="number" value={tempC} onChange={e => setTempC(e.target.value)} placeholder="e.g. 18"
              className="w-full border rounded-lg px-2 py-1.5 text-xs"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="text-[10px] mb-1 block" style={{ color: 'var(--text-muted)' }}>Wind (mph)</label>
            <input type="number" value={windMph} onChange={e => setWindMph(e.target.value)} placeholder="e.g. 12"
              className="w-full border rounded-lg px-2 py-1.5 text-xs"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="text-[10px] mb-1 block" style={{ color: 'var(--text-muted)' }}>Rain (mm)</label>
            <input type="number" value={rainMm} onChange={e => setRainMm(e.target.value)} placeholder="e.g. 0"
              className="w-full border rounded-lg px-2 py-1.5 text-xs"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] mb-1 block" style={{ color: 'var(--text-muted)' }}>Description</label>
            <input value={weatherDesc} onChange={e => setWeatherDesc(e.target.value)} placeholder="e.g. Dry, overcast, warm"
              className="w-full border rounded-lg px-2 py-1.5 text-xs"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="text-[10px] mb-1 block" style={{ color: 'var(--text-muted)' }}>Weather impact on work</label>
            <div className="flex gap-2">
              {['None', ...IMPACTS].map(imp => (
                <button key={imp} onClick={() => setWeatherImpact(imp)}
                  className="flex-1 text-[10px] py-1.5 rounded-lg border font-medium transition-colors"
                  style={{
                    borderColor: weatherImpact === imp ? 'var(--accent)' : 'var(--border)',
                    background: weatherImpact === imp ? 'rgba(108,114,245,0.15)' : 'var(--bg-elevated)',
                    color: weatherImpact === imp ? 'var(--accent)' : 'var(--text-muted)',
                  }}>
                  {imp}
                </button>
              ))}
            </div>
          </div>
        </div>
        {weatherImpact !== 'None' && (
          <div className="mt-2">
            <label className="text-[10px] mb-1 block" style={{ color: 'var(--text-muted)' }}>Hours lost to weather</label>
            <input type="number" value={lostHrs} onChange={e => setLostHrs(e.target.value)} placeholder="0"
              className="w-32 border rounded-lg px-2 py-1.5 text-xs"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          </div>
        )}
      </div>

      {/* Personnel */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Personnel on site</p>
          <button onClick={addPerson} className="flex items-center gap-1 text-xs px-2 py-1 rounded border hover:opacity-80"
            style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>
            <Plus size={11} /> Add
          </button>
        </div>
        <div className="space-y-2">
          {personnel.map((p, i) => (
            <div key={i} className="grid gap-2 items-center rounded-lg p-2" style={{ background: 'var(--bg-elevated)', gridTemplateColumns: '2fr 1fr 1fr 60px 2fr auto' }}>
              <input value={p.name} onChange={e => updatePerson(i, 'name', e.target.value)} placeholder="Full name"
                className="border rounded px-2 py-1 text-xs"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              <select value={p.role} onChange={e => updatePerson(i, 'role', e.target.value)}
                className="border rounded px-2 py-1 text-xs"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
              <input value={p.company} onChange={e => updatePerson(i, 'company', e.target.value)} placeholder="Company"
                className="border rounded px-2 py-1 text-xs"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              <input type="number" value={p.hours} onChange={e => updatePerson(i, 'hours', e.target.value)} placeholder="hrs"
                className="border rounded px-2 py-1 text-xs"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              <input value={p.note} onChange={e => updatePerson(i, 'note', e.target.value)} placeholder="Note (e.g. left early 15:00)"
                className="border rounded px-2 py-1 text-xs"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              <button onClick={() => removePerson(i)} className="hover:opacity-70 p-1">
                <Trash2 size={12} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
          ))}
        </div>
        {personnel.filter(p => p.name && p.hours).length > 0 && (
          <p className="text-xs mt-2 text-right" style={{ color: 'var(--text-muted)' }}>
            Total: <strong style={{ color: 'var(--text-primary)' }}>
              {personnel.reduce((s, p) => s + (Number(p.hours) || 0), 0)}h
            </strong> across {personnel.filter(p => p.name).length} people
          </p>
        )}
      </div>

      {/* Issues */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Issues / blockers</p>
          <button onClick={addIssue} className="flex items-center gap-1 text-xs px-2 py-1 rounded border hover:opacity-80"
            style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>
            <Plus size={11} /> Add issue
          </button>
        </div>
        <div className="space-y-2">
          {issues.map((issue, i) => (
            <div key={i} className="rounded-lg p-3 space-y-2" style={{ background: 'var(--bg-elevated)' }}>
              <div className="flex gap-2 items-center">
                <select value={issue.impact} onChange={e => updateIssue(i, 'impact', e.target.value)}
                  className="border rounded px-2 py-1 text-xs w-28 shrink-0"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  {IMPACTS.map(imp => <option key={imp}>{imp}</option>)}
                </select>
                <select value={issue.status} onChange={e => updateIssue(i, 'status', e.target.value)}
                  className="border rounded px-2 py-1 text-xs w-24 shrink-0"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  <option>Open</option><option>Closed</option>
                </select>
                <button onClick={() => removeIssue(i)} className="ml-auto hover:opacity-70 p-1">
                  <Trash2 size={12} style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>
              <input value={issue.description} onChange={e => updateIssue(i, 'description', e.target.value)}
                placeholder="Issue description"
                className="w-full border rounded px-2 py-1 text-xs"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              <input value={issue.action} onChange={e => updateIssue(i, 'action', e.target.value)}
                placeholder="Recommended action"
                className="w-full border rounded px-2 py-1 text-xs"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Day summary</label>
        <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3}
          placeholder="Brief summary of work completed today..."
          className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {aiFlags.length > 0 && (
        <div className="rounded-lg p-3 space-y-1" style={{ background: '#f59e0b18', border: '1px solid #f59e0b44' }}>
          <p className="text-xs font-semibold" style={{ color: '#f59e0b' }}>AI review flagged {aiFlags.length} item{aiFlags.length !== 1 ? 's' : ''}:</p>
          {aiFlags.map((flag, i) => (
            <p key={i} className="text-xs" style={{ color: 'var(--text-primary)' }}>· {flag}</p>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button onClick={onSaved}
          className="px-4 py-2 rounded-lg text-xs border hover:opacity-70"
          style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-white hover:opacity-80 disabled:opacity-50"
          style={{ background: 'var(--accent)' }}>
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          {saving ? 'Analysing & saving…' : 'Save log'}
        </button>
      </div>
    </div>
  )
}
