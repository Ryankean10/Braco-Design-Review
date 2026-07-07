'use client'

import { useState } from 'react'
import { Zap, Clock, Users, Calendar, AlertTriangle, ChevronRight, Loader2 } from 'lucide-react'

interface SiteInput {
  name: string
  mvsCount: string
  acBatteryCables: string
  stringCables: string
  lvPowerCables: string
  commsCables: string
  siteSizeHa: string
  locationRegion: string
  accessDifficulty: string
  notes: string
}

interface Forecast {
  summary: string
  duration_weeks: number
  duration_days: number
  peak_crew: number
  recommended_crew: number
  total_manhours: number
  phases: { name: string; duration_days: number; crew: number; manhours: number; description: string }[]
  risks: string[]
  assumptions: string[]
  benchmark_notes: string
}

const DEFAULT: SiteInput = {
  name: '',
  mvsCount: '',
  acBatteryCables: '',
  stringCables: '',
  lvPowerCables: '',
  commsCables: '',
  siteSizeHa: '',
  locationRegion: 'Scotland',
  accessDifficulty: 'Standard',
  notes: '',
}

export default function WorkPlanner() {
  const [form, setForm] = useState<SiteInput>(DEFAULT)
  const [loading, setLoading] = useState(false)
  const [forecast, setForecast] = useState<Forecast | null>(null)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof SiteInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setForecast(null)
    try {
      const res = await fetch('/api/planning/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const text = await res.text()
      let data: any
      try { data = JSON.parse(text) } catch {
        console.error('Forecast raw response:', text.slice(0, 500))
        throw new Error('Server returned an unexpected response — please try again')
      }
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`)
      setForecast(data)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full rounded-lg px-3 py-2 text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40"
  const inputStyle = { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }
  const labelClass = "block text-xs font-medium mb-1"
  const labelStyle = { color: 'var(--text-muted)' }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* Input form */}
      <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
        <h2 className="text-sm font-semibold mb-5 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Zap size={14} className="text-blue-400"/> New Site Parameters
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className={labelClass} style={labelStyle}>Site name</label>
            <input className={inputClass} style={inputStyle} value={form.name} onChange={set('name')} placeholder="e.g. Alford BESS" required/>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={labelStyle}>No. of MVS banks</label>
              <input className={inputClass} style={inputStyle} type="number" min="1" value={form.mvsCount} onChange={set('mvsCount')} placeholder="e.g. 7" required/>
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Site size (ha)</label>
              <input className={inputClass} style={inputStyle} type="number" step="0.1" value={form.siteSizeHa} onChange={set('siteSizeHa')} placeholder="e.g. 1.5"/>
            </div>
          </div>

          <div className="pt-1 pb-1">
            <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>Cable quantities</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { k: 'acBatteryCables' as const, label: 'AC Battery (LV 240mm²)', ph: '252' },
                { k: 'stringCables' as const, label: 'DC String cables', ph: '210' },
                { k: 'lvPowerCables' as const, label: 'LV Power (other)', ph: '56' },
                { k: 'commsCables' as const, label: 'Comms / fibre', ph: '25' },
              ].map(({ k, label, ph }) => (
                <div key={k}>
                  <label className={labelClass} style={labelStyle}>{label}</label>
                  <input className={inputClass} style={inputStyle} type="number" min="0" value={form[k]} onChange={set(k)} placeholder={ph}/>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={labelStyle}>Region</label>
              <select className={inputClass} style={inputStyle} value={form.locationRegion} onChange={set('locationRegion')}>
                {['Scotland', 'North England', 'Midlands', 'South England', 'Wales'].map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Site access</label>
              <select className={inputClass} style={inputStyle} value={form.accessDifficulty} onChange={set('accessDifficulty')}>
                {['Standard', 'Restricted', 'Remote', 'Very remote'].map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>Additional notes</label>
            <textarea className={inputClass} style={inputStyle} rows={3} value={form.notes} onChange={set('notes')}
              placeholder="e.g. Similar kit to Braco, 2 strings per MVS, client target energise Oct 2026..."/>
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: 'var(--accent)', color: 'white' }}>
            {loading ? <><Loader2 size={14} className="animate-spin"/> Forecasting…</> : <>Generate Forecast <ChevronRight size={14}/></>}
          </button>

          {error && <p className="text-xs text-red-400 text-center">{error}</p>}
        </form>
      </div>

      {/* Forecast output */}
      <div className="space-y-4">
        {!forecast && !loading && (
          <div className="rounded-xl border p-8 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
            <Calendar size={32} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text-muted)' }}/>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Fill in the site parameters and click Generate Forecast.<br/>Benchmarks from {'>'}1,000 Dyce manhours will be applied.</p>
          </div>
        )}

        {loading && (
          <div className="rounded-xl border p-8 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
            <Loader2 size={32} className="mx-auto mb-3 animate-spin opacity-50" style={{ color: 'var(--accent)' }}/>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Analysing Dyce benchmarks…</p>
          </div>
        )}

        {forecast && (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Duration', value: `${forecast.duration_weeks}w`, sub: `${forecast.duration_days} days`, icon: <Calendar size={13}/>, color: '#3b82f6' },
                { label: 'Crew', value: forecast.recommended_crew, sub: `peak ${forecast.peak_crew}`, icon: <Users size={13}/>, color: '#8b5cf6' },
                { label: 'Manhours', value: forecast.total_manhours.toLocaleString(), sub: 'total', icon: <Clock size={13}/>, color: '#10b981' },
                { label: 'Risks', value: forecast.risks.length, sub: 'flagged', icon: <AlertTriangle size={13}/>, color: '#f59e0b' },
              ].map(k => (
                <div key={k.label} className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
                  <div className="flex items-center gap-1 mb-1" style={{ color: k.color }}>{k.icon}<span className="text-xs">{k.label}</span></div>
                  <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{k.value}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{forecast.summary}</p>
              {forecast.benchmark_notes && (
                <p className="text-xs mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  <strong>vs Dyce:</strong> {forecast.benchmark_notes}
                </p>
              )}
            </div>

            {/* Phases */}
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
              <h3 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>PROGRAMME PHASES</h3>
              <div className="space-y-3">
                {forecast.phases.map((ph, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 text-white" style={{ background: 'var(--accent)' }}>{i+1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{ph.name}</span>
                        <span className="shrink-0 ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>{ph.duration_days}d · {ph.crew} crew · {ph.manhours}h</span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{ph.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Risks */}
            {forecast.risks.length > 0 && (
              <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
                <h3 className="text-xs font-semibold mb-2 flex items-center gap-1" style={{ color: '#f59e0b' }}>
                  <AlertTriangle size={11}/> KEY RISKS
                </h3>
                <ul className="space-y-1">
                  {forecast.risks.map((r, i) => (
                    <li key={i} className="text-xs flex gap-2" style={{ color: 'var(--text-primary)' }}>
                      <span style={{ color: '#f59e0b' }}>·</span>{r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Assumptions */}
            {forecast.assumptions.length > 0 && (
              <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
                <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>ASSUMPTIONS</h3>
                <ul className="space-y-1">
                  {forecast.assumptions.map((a, i) => (
                    <li key={i} className="text-xs flex gap-2" style={{ color: 'var(--text-muted)' }}>
                      <span>·</span>{a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
