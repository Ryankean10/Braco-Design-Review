'use client'

import { useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, Cloud, Users, Zap, AlertTriangle, Clock } from 'lucide-react'

interface DailyLog {
  log_date: string
  total_manhours: number | null
  weather_conditions: string | null
  weather_description: string | null
  weather_lost_hours: number | null
  weather_impact: string | null
  personnel: { name: string; role: string; hours: number; note?: string }[] | null
  issues: { description: string; impact: string; status: string }[] | null
  summary: string | null
}

interface Props {
  logs: DailyLog[]
  totalCables: number
  completedCables: number
}

const ROLE_COLOR: Record<string, string> = {
  Electrician: '#3b82f6',
  Apprentice: '#8b5cf6',
  'Site Manager': '#10b981',
  Engineer: '#f59e0b',
  Other: '#6b7280',
}

export default function SiteAnalytics({ logs, totalCables, completedCables }: Props) {
  const [filter, setFilter] = useState<'all' | 'good' | 'fair' | 'poor'>('all')

  const sorted = useMemo(() => [...logs].sort((a, b) => a.log_date.localeCompare(b.log_date)), [logs])

  const withCrew = useMemo(() => sorted.map(l => ({
    ...l,
    crewSize: l.personnel?.length ?? 0,
    electricians: l.personnel?.filter(p => p.role === 'Electrician').length ?? 0,
    apprentices: l.personnel?.filter(p => p.role === 'Apprentice').length ?? 0,
    hoursPerHead: l.personnel?.length && l.total_manhours
      ? l.total_manhours / l.personnel.length : 0,
    openIssues: l.issues?.filter(i => i.status === 'Open').length ?? 0,
  })), [sorted])

  const filtered = filter === 'all' ? withCrew
    : withCrew.filter(l => (l.weather_conditions ?? '').toLowerCase() === filter)

  // KPIs
  const totalManhours = sorted.reduce((s, l) => s + (l.total_manhours ?? 0), 0)
  const daysOnSite = sorted.length
  const avgManhours = daysOnSite ? totalManhours / daysOnSite : 0
  const avgCrew = withCrew.reduce((s, l) => s + l.crewSize, 0) / (daysOnSite || 1)
  const totalLostHours = sorted.reduce((s, l) => s + (l.weather_lost_hours ?? 0), 0)
  const peakDay = withCrew.reduce((a, b) => (b.total_manhours ?? 0) > (a.total_manhours ?? 0) ? b : a, withCrew[0])
  const worstDay = withCrew.filter(l => (l.total_manhours ?? 0) > 0)
    .reduce((a, b) => (b.total_manhours ?? 0) < (a.total_manhours ?? 0) ? b : a, withCrew[0])

  // Slow day = below 80% of average
  const slowDays = withCrew.filter(l => (l.total_manhours ?? 0) > 0 && (l.total_manhours ?? 0) < avgManhours * 0.8)

  // Weather breakdown
  const weatherGroups = useMemo(() => {
    const g: Record<string, { count: number; hours: number; lost: number }> = {}
    for (const l of withCrew) {
      const k = l.weather_conditions ?? 'Not recorded'
      if (!g[k]) g[k] = { count: 0, hours: 0, lost: 0 }
      g[k].count++
      g[k].hours += l.total_manhours ?? 0
      g[k].lost += l.weather_lost_hours ?? 0
    }
    return g
  }, [withCrew])

  // Role breakdown across all days
  const roleHours = useMemo(() => {
    const g: Record<string, number> = {}
    for (const l of sorted) {
      for (const p of l.personnel ?? []) {
        g[p.role] = (g[p.role] ?? 0) + (p.hours ?? 0)
      }
    }
    return g
  }, [sorted])

  // Unique people
  const uniquePeople = useMemo(() => {
    const people: Record<string, { role: string; days: number; hours: number }> = {}
    for (const l of sorted) {
      for (const p of l.personnel ?? []) {
        if (!people[p.name]) people[p.name] = { role: p.role, days: 0, hours: 0 }
        people[p.name].days++
        people[p.name].hours += p.hours ?? 0
      }
    }
    return Object.entries(people).sort((a, b) => b[1].hours - a[1].hours)
  }, [sorted])

  // Manhours chart
  const chartLogs = filtered
  const maxH = Math.max(...chartLogs.map(l => l.total_manhours ?? 0), 1)
  const chartW = 700
  const chartH = 120
  const barW = Math.max(6, Math.floor((chartW - 20) / Math.max(chartLogs.length, 1)) - 2)

  const weatherColor = (w: string | null) => w === 'Good' ? '#22c55e' : w === 'Fair' ? '#f59e0b' : w === 'Poor' ? '#ef4444' : '#6b7280'

  return (
    <div className="space-y-5">

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Manhours', value: totalManhours.toLocaleString('en-GB', {maximumFractionDigits:0}), sub: `${daysOnSite} site days`, icon: <Clock size={16}/>, color: '#3b82f6' },
          { label: 'Avg Manhours/Day', value: avgManhours.toFixed(1), sub: `${avgCrew.toFixed(1)} avg crew`, icon: <Users size={16}/>, color: '#8b5cf6' },
          { label: 'Peak Day', value: (peakDay?.total_manhours ?? 0).toFixed(0)+'h', sub: peakDay ? new Date(peakDay.log_date+'T12:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short'}) : '—', icon: <TrendingUp size={16}/>, color: '#22c55e' },
          { label: 'Weather Lost', value: totalLostHours+'h', sub: `${slowDays.length} slow days`, icon: <Cloud size={16}/>, color: '#f59e0b' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
            <div className="flex items-center gap-1.5 mb-1" style={{ color: k.color }}>{k.icon}<span className="text-xs font-medium">{k.label}</span></div>
            <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{k.value}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Manhours chart with weather filter */}
      <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Daily Manhours</h3>
          <div className="flex gap-1">
            {(['all','good','fair','poor'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className="px-2.5 py-1 rounded-md text-xs capitalize transition-all"
                style={{
                  background: filter === f ? 'var(--accent)' : 'var(--surface)',
                  color: filter === f ? 'white' : 'var(--text-muted)',
                  border: '1px solid var(--border)'
                }}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <svg viewBox={`0 0 ${chartW} ${chartH + 30}`} className="w-full" style={{ maxHeight: 180 }}>
          {[0.25,0.5,0.75,1].map(f => (
            <g key={f}>
              <line x1="20" y1={chartH - f*chartH} x2={chartW} y2={chartH - f*chartH} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3 3"/>
              <text x="0" y={chartH - f*chartH + 3} fontSize="8" fill="var(--text-muted)">{Math.round(f*maxH)}</text>
            </g>
          ))}
          {chartLogs.map((log, i) => {
            const h = ((log.total_manhours ?? 0) / maxH) * chartH
            const x = 20 + i * (barW + 2)
            const isSlow = (log.total_manhours ?? 0) > 0 && (log.total_manhours ?? 0) < avgManhours * 0.8
            const color = isSlow ? '#ef4444' : weatherColor(log.weather_conditions)
            const label = new Date(log.log_date+'T12:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short'})
            return (
              <g key={log.log_date}>
                <rect x={x} y={chartH - h} width={barW} height={h} rx="2" fill={color} opacity="0.85"/>
                {i % Math.max(1, Math.floor(chartLogs.length / 10)) === 0 && (
                  <text x={x + barW/2} y={chartH + 14} fontSize="7" textAnchor="middle" fill="var(--text-muted)">{label}</text>
                )}
              </g>
            )
          })}
          <line x1="20" y1={chartH} x2={chartW} y2={chartH} stroke="var(--border)" strokeWidth="1"/>
          {/* Average line */}
          <line x1="20" y1={chartH - (avgManhours/maxH)*chartH} x2={chartW} y2={chartH - (avgManhours/maxH)*chartH}
            stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 2" opacity="0.6"/>
          <text x={chartW - 2} y={chartH - (avgManhours/maxH)*chartH - 3} fontSize="7" textAnchor="end" fill="#3b82f6">avg</text>
        </svg>
        <div className="flex gap-4 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{background:'#22c55e'}}/> Good weather</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{background:'#f59e0b'}}/> Fair weather</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{background:'#ef4444'}}/> Poor / Slow day</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{background:'#6b7280'}}/> Not recorded</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

        {/* Weather impact */}
        <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Weather Impact</h3>
          <div className="space-y-3">
            {Object.entries(weatherGroups).sort().map(([w, g]) => (
              <div key={w}>
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: 'var(--text-primary)' }}>{w}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{g.count} days · {g.hours.toFixed(0)}h · {g.lost}h lost</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface)' }}>
                  <div className="h-full rounded-full" style={{ width: `${(g.count / daysOnSite) * 100}%`, background: weatherColor(w === 'Not recorded' ? null : w) }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs mt-4 pt-3 border-t" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            Avg manhours on Good days: <strong>{weatherGroups['Good'] ? (weatherGroups['Good'].hours / weatherGroups['Good'].count).toFixed(1) : '—'}</strong> vs
            Poor days: <strong>{weatherGroups['Poor'] ? (weatherGroups['Poor'].hours / weatherGroups['Poor'].count).toFixed(1) : '—'}</strong>
          </p>
        </div>

        {/* Role breakdown */}
        <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Hours by Role</h3>
          <div className="space-y-3">
            {Object.entries(roleHours).sort((a,b) => b[1]-a[1]).map(([role, hours]) => {
              const pct = (hours / totalManhours) * 100
              return (
                <div key={role}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: 'var(--text-primary)' }}>{role}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{hours.toFixed(0)}h ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ROLE_COLOR[role] ?? '#6b7280' }}/>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Slow days */}
      {slowDays.length > 0 && (
        <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <AlertTriangle size={14} style={{ color: '#f59e0b' }}/> Slow Days (below 80% of average)
          </h3>
          <div className="space-y-2">
            {slowDays.map(l => (
              <div key={l.log_date} className="flex items-start gap-3 text-sm py-2 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                <span className="shrink-0 font-medium w-24" style={{ color: 'var(--text-primary)' }}>
                  {new Date(l.log_date+'T12:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'2-digit'})}
                </span>
                <span style={{ color: '#f59e0b' }} className="shrink-0 w-12">{l.total_manhours}h</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{l.summary?.slice(0,120) ?? l.weather_description ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* People league table */}
      <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>People — Days & Hours on Site</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs border-b" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                <th className="text-left pb-2">Name</th>
                <th className="text-left pb-2">Role</th>
                <th className="text-right pb-2">Days</th>
                <th className="text-right pb-2">Hours</th>
                <th className="text-right pb-2">Avg/Day</th>
              </tr>
            </thead>
            <tbody>
              {uniquePeople.map(([name, p]) => (
                <tr key={name} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                  <td className="py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{name}</td>
                  <td className="py-2 text-xs">
                    <span className="px-2 py-0.5 rounded-full text-white text-xs" style={{ background: ROLE_COLOR[p.role] ?? '#6b7280' }}>{p.role}</span>
                  </td>
                  <td className="py-2 text-right" style={{ color: 'var(--text-muted)' }}>{p.days}</td>
                  <td className="py-2 text-right font-medium" style={{ color: 'var(--text-primary)' }}>{p.hours.toFixed(0)}</td>
                  <td className="py-2 text-right" style={{ color: 'var(--text-muted)' }}>{(p.hours/p.days).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
