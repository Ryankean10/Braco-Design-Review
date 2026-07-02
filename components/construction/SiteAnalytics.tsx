'use client'

import { useMemo, useState } from 'react'
import { Cloud, Users, AlertTriangle, Clock, ChevronDown, ChevronUp } from 'lucide-react'

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
  Labourer: '#ec4899',
  Other: '#6b7280',
}

const ROLE_ORDER = ['Site Manager', 'Engineer', 'Electrician', 'Apprentice', 'Labourer', 'Other']

function roleColor(role: string) {
  return ROLE_COLOR[role] ?? ROLE_COLOR.Other
}

function weatherColor(w: string | null) {
  return w === 'Good' ? '#22c55e' : w === 'Fair' ? '#f59e0b' : w === 'Poor' ? '#ef4444' : '#6b7280'
}

function fmt(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}
function fmtLong(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: '2-digit' })
}

export default function SiteAnalytics({ logs }: Props) {
  const [weatherFilter, setWeatherFilter] = useState<'all' | 'good' | 'fair' | 'poor'>('all')
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [rosterSearch, setRosterSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'manhours' | 'crew' | 'roster'>('crew')

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

  const filtered = weatherFilter === 'all' ? withCrew
    : withCrew.filter(l => (l.weather_conditions ?? '').toLowerCase() === weatherFilter)

  // KPIs
  const totalManhours = sorted.reduce((s, l) => s + (l.total_manhours ?? 0), 0)
  const daysOnSite = sorted.length
  const avgManhours = daysOnSite ? totalManhours / daysOnSite : 0
  const avgCrew = withCrew.reduce((s, l) => s + l.crewSize, 0) / (daysOnSite || 1)
  const totalLostHours = sorted.reduce((s, l) => s + (l.weather_lost_hours ?? 0), 0)
  const peakDay = withCrew.reduce((a, b) => (b.crewSize) > (a.crewSize) ? b : a, withCrew[0])
  const slowDays = withCrew.filter(l => (l.total_manhours ?? 0) > 0 && (l.total_manhours ?? 0) < avgManhours * 0.8)

  // Unique people
  const uniquePeople = useMemo(() => {
    const people: Record<string, { role: string; days: number; hours: number; lastSeen: string }> = {}
    for (const l of sorted) {
      for (const p of l.personnel ?? []) {
        if (!people[p.name]) people[p.name] = { role: p.role, days: 0, hours: 0, lastSeen: l.log_date }
        people[p.name].days++
        people[p.name].hours += p.hours ?? 0
        if (l.log_date > people[p.name].lastSeen) people[p.name].lastSeen = l.log_date
      }
    }
    return Object.entries(people).sort((a, b) => b[1].hours - a[1].hours)
  }, [sorted])

  // Role breakdown totals
  const roleHours = useMemo(() => {
    const g: Record<string, number> = {}
    for (const l of sorted) for (const p of l.personnel ?? []) g[p.role] = (g[p.role] ?? 0) + (p.hours ?? 0)
    return g
  }, [sorted])

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

  // Charts
  const maxH = Math.max(...filtered.map(l => l.total_manhours ?? 0), 1)
  const maxCrew = Math.max(...filtered.map(l => l.crewSize), 1)
  const chartW = 700
  const barW = Math.max(6, Math.floor((chartW - 20) / Math.max(filtered.length, 1)) - 2)

  // All roles seen across logs
  const allRoles = useMemo(() => {
    const r = new Set<string>()
    for (const l of sorted) for (const p of l.personnel ?? []) r.add(p.role)
    return ROLE_ORDER.filter(ro => r.has(ro)).concat([...r].filter(ro => !ROLE_ORDER.includes(ro)))
  }, [sorted])

  // Filtered people for roster search
  const filteredPeople = rosterSearch
    ? uniquePeople.filter(([name]) => name.toLowerCase().includes(rosterSearch.toLowerCase()))
    : uniquePeople

  // Attendance grid: who was on site each day (for roster tab)
  const recentDays = sorted.slice(-20) // last 20 days for the grid

  return (
    <div className="space-y-5">

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Manhours', value: totalManhours.toLocaleString('en-GB', { maximumFractionDigits: 0 }), sub: `${daysOnSite} site days`, icon: <Clock size={15} />, color: '#3b82f6' },
          { label: 'Avg Crew / Day', value: avgCrew.toFixed(1), sub: `peak ${peakDay?.crewSize ?? 0} on ${peakDay ? fmt(peakDay.log_date) : '—'}`, icon: <Users size={15} />, color: '#8b5cf6' },
          { label: 'Avg Manhours / Day', value: avgManhours.toFixed(1), sub: `${(totalManhours / (uniquePeople.length || 1)).toFixed(0)}h per person (all time)`, icon: <Clock size={15} />, color: '#10b981' },
          { label: 'Weather Lost', value: `${totalLostHours}h`, sub: `${slowDays.length} slow days`, icon: <Cloud size={15} />, color: '#f59e0b' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
            <div className="flex items-center gap-1.5 mb-1" style={{ color: k.color }}>{k.icon}<span className="text-xs font-medium">{k.label}</span></div>
            <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{k.value}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}>
        {([
          { id: 'crew', label: 'Crew per Day' },
          { id: 'manhours', label: 'Manhours' },
          { id: 'roster', label: 'Roster & Attendance' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
            style={{
              background: activeTab === t.id ? 'var(--accent)' : 'transparent',
              color: activeTab === t.id ? 'white' : 'var(--text-muted)',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Crew per Day chart */}
      {activeTab === 'crew' && (
        <div className="rounded-xl border p-5 space-y-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Crew on Site — Stacked by Role</h3>
            <div className="flex gap-1">
              {(['all', 'good', 'fair', 'poor'] as const).map(f => (
                <button key={f} onClick={() => setWeatherFilter(f)}
                  className="px-2.5 py-1 rounded-md text-xs capitalize transition-all"
                  style={{ background: weatherFilter === f ? 'var(--accent)' : 'var(--surface)', color: weatherFilter === f ? 'white' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          <svg viewBox={`0 0 ${chartW} 150`} className="w-full" style={{ maxHeight: 180 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8].filter(v => v <= maxCrew + 1).map(v => (
              <g key={v}>
                <line x1="20" y1={130 - (v / (maxCrew + 1)) * 130} x2={chartW} y2={130 - (v / (maxCrew + 1)) * 130}
                  stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3 3" />
                <text x="0" y={130 - (v / (maxCrew + 1)) * 130 + 3} fontSize="8" fill="var(--text-muted)">{v}</text>
              </g>
            ))}
            {filtered.map((log, i) => {
              const x = 20 + i * (barW + 2)
              const crew = log.personnel ?? []
              // Stack by role
              let yOffset = 130
              const roleGroups: Record<string, number> = {}
              for (const p of crew) roleGroups[p.role] = (roleGroups[p.role] ?? 0) + 1
              const label = fmt(log.log_date)
              const showLabel = i % Math.max(1, Math.floor(filtered.length / 10)) === 0

              return (
                <g key={log.log_date} className="cursor-pointer" onClick={() => setExpandedDay(expandedDay === log.log_date ? null : log.log_date)}>
                  {allRoles.map(role => {
                    const count = roleGroups[role] ?? 0
                    if (!count) return null
                    const h = (count / (maxCrew + 1)) * 130
                    yOffset -= h
                    return <rect key={role} x={x} y={yOffset} width={barW} height={h} rx="1" fill={roleColor(role)} opacity={expandedDay === log.log_date ? 1 : 0.8} />
                  })}
                  {expandedDay === log.log_date && (
                    <rect x={x - 1} y={0} width={barW + 2} height={132} rx="2" fill="none" stroke="white" strokeWidth="1.5" opacity="0.6" />
                  )}
                  {showLabel && (
                    <text x={x + barW / 2} y={145} fontSize="7" textAnchor="middle" fill="var(--text-muted)">{label}</text>
                  )}
                </g>
              )
            })}
            <line x1="20" y1={130} x2={chartW} y2={130} stroke="var(--border)" strokeWidth="1" />
            {/* Avg crew line */}
            <line x1="20" y1={130 - (avgCrew / (maxCrew + 1)) * 130} x2={chartW} y2={130 - (avgCrew / (maxCrew + 1)) * 130}
              stroke="#8b5cf6" strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />
          </svg>

          {/* Role legend */}
          <div className="flex flex-wrap gap-3">
            {allRoles.map(r => (
              <span key={r} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: roleColor(r) }} />
                {r}
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="inline-block w-5 border-t border-dashed" style={{ borderColor: '#8b5cf6' }} /> avg
            </span>
          </div>

          {/* Click-expanded day detail */}
          {expandedDay && (() => {
            const day = withCrew.find(l => l.log_date === expandedDay)
            if (!day) return null
            const crew = day.personnel ?? []
            return (
              <div className="rounded-lg border p-4 mt-2" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{fmtLong(expandedDay)}</span>
                    <span className="ml-3 text-xs" style={{ color: 'var(--text-muted)' }}>{crew.length} on site · {day.total_manhours}h total</span>
                    {day.weather_conditions && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full text-white" style={{ background: weatherColor(day.weather_conditions) }}>{day.weather_conditions}</span>
                    )}
                  </div>
                  <button onClick={() => setExpandedDay(null)} style={{ color: 'var(--text-muted)' }}><ChevronUp size={14} /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[...crew].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)).map((p, i) => (
                    <div key={i} className="flex items-center gap-2.5 rounded-lg px-3 py-2" style={{ background: 'var(--surface-raised)' }}>
                      <div className="w-1.5 h-8 rounded-full shrink-0" style={{ background: roleColor(p.role) }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.role} · {p.hours}h{p.note ? ` · ${p.note}` : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {day.summary && <p className="text-xs mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>{day.summary}</p>}
              </div>
            )
          })()}

          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Click any bar to see the full crew list for that day.</p>
        </div>
      )}

      {/* Manhours chart */}
      {activeTab === 'manhours' && (
        <div className="rounded-xl border p-5 space-y-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Daily Manhours</h3>
            <div className="flex gap-1">
              {(['all', 'good', 'fair', 'poor'] as const).map(f => (
                <button key={f} onClick={() => setWeatherFilter(f)}
                  className="px-2.5 py-1 rounded-md text-xs capitalize transition-all"
                  style={{ background: weatherFilter === f ? 'var(--accent)' : 'var(--surface)', color: weatherFilter === f ? 'white' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <svg viewBox={`0 0 ${chartW} 150`} className="w-full" style={{ maxHeight: 180 }}>
            {[0.25, 0.5, 0.75, 1].map(f => (
              <g key={f}>
                <line x1="20" y1={130 - f * 130} x2={chartW} y2={130 - f * 130} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3 3" />
                <text x="0" y={130 - f * 130 + 3} fontSize="8" fill="var(--text-muted)">{Math.round(f * maxH)}</text>
              </g>
            ))}
            {filtered.map((log, i) => {
              const h = ((log.total_manhours ?? 0) / maxH) * 130
              const x = 20 + i * (barW + 2)
              const isSlow = (log.total_manhours ?? 0) > 0 && (log.total_manhours ?? 0) < avgManhours * 0.8
              const color = isSlow ? '#ef4444' : weatherColor(log.weather_conditions)
              const showLabel = i % Math.max(1, Math.floor(filtered.length / 10)) === 0
              return (
                <g key={log.log_date} className="cursor-pointer" onClick={() => setExpandedDay(expandedDay === log.log_date ? null : log.log_date)}>
                  <rect x={x} y={130 - h} width={barW} height={h} rx="2" fill={color} opacity="0.85" />
                  {showLabel && <text x={x + barW / 2} y={145} fontSize="7" textAnchor="middle" fill="var(--text-muted)">{fmt(log.log_date)}</text>}
                </g>
              )
            })}
            <line x1="20" y1={130} x2={chartW} y2={130} stroke="var(--border)" strokeWidth="1" />
            <line x1="20" y1={130 - (avgManhours / maxH) * 130} x2={chartW} y2={130 - (avgManhours / maxH) * 130}
              stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 2" opacity="0.6" />
            <text x={chartW - 2} y={130 - (avgManhours / maxH) * 130 - 3} fontSize="7" textAnchor="end" fill="#3b82f6">avg</text>
          </svg>
          <div className="flex gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#22c55e' }} /> Good</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#f59e0b' }} /> Fair</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#ef4444' }} /> Poor / Slow</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#6b7280' }} /> Not recorded</span>
          </div>

          {/* Slow days */}
          {slowDays.length > 0 && (
            <div className="rounded-lg border p-3 mt-2" style={{ borderColor: 'var(--border)' }}>
              <h4 className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: '#f59e0b' }}>
                <AlertTriangle size={12} /> Slow days — below 80% of average ({avgManhours.toFixed(0)}h)
              </h4>
              <div className="space-y-1.5">
                {slowDays.map(l => (
                  <div key={l.log_date} className="flex items-start gap-3 text-xs">
                    <span className="shrink-0 font-medium w-20" style={{ color: 'var(--text-primary)' }}>{fmt(l.log_date)}</span>
                    <span className="shrink-0 w-8" style={{ color: '#f59e0b' }}>{l.total_manhours}h</span>
                    <span className="shrink-0 w-8" style={{ color: 'var(--text-muted)' }}>{l.crewSize} crew</span>
                    <span style={{ color: 'var(--text-muted)' }}>{l.summary?.slice(0, 100) ?? l.weather_description ?? '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weather impact */}
          <div>
            <h4 className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Weather breakdown</h4>
            <div className="space-y-2">
              {Object.entries(weatherGroups).sort().map(([w, g]) => (
                <div key={w}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: 'var(--text-primary)' }}>{w}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{g.count} days · {g.hours.toFixed(0)}h · {g.lost}h lost</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface)' }}>
                    <div className="h-full rounded-full" style={{ width: `${(g.count / daysOnSite) * 100}%`, background: weatherColor(w === 'Not recorded' ? null : w) }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Role hours */}
          <div>
            <h4 className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Hours by role</h4>
            <div className="space-y-2">
              {Object.entries(roleHours).sort((a, b) => b[1] - a[1]).map(([role, hours]) => {
                const pct = (hours / totalManhours) * 100
                return (
                  <div key={role}>
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: 'var(--text-primary)' }}>{role}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{hours.toFixed(0)}h ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: roleColor(role) }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Roster & Attendance */}
      {activeTab === 'roster' && (
        <div className="space-y-4">

          {/* People table */}
          <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>All Personnel — {uniquePeople.length} people</h3>
              <input
                className="px-3 py-1.5 rounded-lg text-xs border"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)', width: 160 }}
                placeholder="Search name…"
                value={rosterSearch}
                onChange={e => setRosterSearch(e.target.value)}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs border-b" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                    <th className="text-left pb-2">Name</th>
                    <th className="text-left pb-2">Role</th>
                    <th className="text-right pb-2">Days</th>
                    <th className="text-right pb-2">Hours</th>
                    <th className="text-right pb-2">Avg/Day</th>
                    <th className="text-right pb-2">Last on site</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPeople.map(([name, p]) => (
                    <tr key={name} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                      <td className="py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{name}</td>
                      <td className="py-2">
                        <span className="px-2 py-0.5 rounded-full text-white text-xs" style={{ background: roleColor(p.role) }}>{p.role}</span>
                      </td>
                      <td className="py-2 text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>{p.days}</td>
                      <td className="py-2 text-right font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>{p.hours.toFixed(0)}</td>
                      <td className="py-2 text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>{(p.hours / p.days).toFixed(1)}</td>
                      <td className="py-2 text-right tabular-nums text-xs" style={{ color: 'var(--text-muted)' }}>{fmt(p.lastSeen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Attendance grid — last 20 days */}
          <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Attendance Grid — last {recentDays.length} days</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Filled = on site · hover for hours</p>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse" style={{ minWidth: 'max-content' }}>
                <thead>
                  <tr>
                    <th className="text-left pr-3 pb-2 font-medium" style={{ color: 'var(--text-muted)', minWidth: 130 }}>Name</th>
                    {recentDays.map(d => (
                      <th key={d.log_date} className="pb-2 px-0.5 font-normal text-center" style={{ color: 'var(--text-muted)', minWidth: 28 }}>
                        <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 52, fontSize: 9 }}>{fmt(d.log_date)}</div>
                      </th>
                    ))}
                    <th className="pb-2 pl-2 font-medium text-right" style={{ color: 'var(--text-muted)' }}>Days</th>
                  </tr>
                </thead>
                <tbody>
                  {uniquePeople.map(([name, p]) => (
                    <tr key={name} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="pr-3 py-1 font-medium truncate" style={{ color: 'var(--text-primary)', maxWidth: 130 }}>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: roleColor(p.role) }} />
                          {name}
                        </span>
                      </td>
                      {recentDays.map(d => {
                        const entry = d.personnel?.find(px => px.name === name)
                        return (
                          <td key={d.log_date} className="px-0.5 py-1 text-center">
                            {entry ? (
                              <div title={`${entry.hours}h`}
                                className="w-5 h-5 rounded mx-auto flex items-center justify-center text-white font-bold"
                                style={{ background: roleColor(p.role), fontSize: 8 }}>
                                {entry.hours}
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded mx-auto" style={{ background: 'var(--surface)' }} />
                            )}
                          </td>
                        )
                      })}
                      <td className="pl-2 py-1 text-right font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                        {recentDays.filter(d => d.personnel?.some(px => px.name === name)).length}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Day-by-day detail list */}
          <div className="rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Day-by-Day Crew — click to expand</h3>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {[...withCrew].reverse().map(log => {
                const crew = log.personnel ?? []
                const isOpen = expandedDay === log.log_date
                return (
                  <div key={log.log_date}>
                    <button
                      className="w-full flex items-center gap-3 px-5 py-3 text-left hover:opacity-80 transition-opacity"
                      onClick={() => setExpandedDay(isOpen ? null : log.log_date)}>
                      <span className="w-24 shrink-0 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{fmt(log.log_date)}</span>
                      {/* Mini crew pills */}
                      <span className="flex-1 flex flex-wrap gap-1">
                        {[...crew].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)).map((p, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full text-white text-xs"
                            style={{ background: roleColor(p.role) }}>{p.name.split(' ')[0]}</span>
                        ))}
                        {crew.length === 0 && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>No data</span>}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>{crew.length} · {log.total_manhours}h</span>
                      {isOpen ? <ChevronUp size={13} className="shrink-0" style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={13} className="shrink-0" style={{ color: 'var(--text-muted)' }} />}
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-1">
                          {[...crew].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)).map((p, i) => (
                            <div key={i} className="flex items-center gap-2.5 rounded-lg px-3 py-2" style={{ background: 'var(--surface)' }}>
                              <div className="w-1 h-8 rounded-full shrink-0" style={{ background: roleColor(p.role) }} />
                              <div>
                                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.role} · {p.hours}h{p.note ? ` · ${p.note}` : ''}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        {log.summary && <p className="text-xs mt-3 pt-2 border-t" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>{log.summary}</p>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
