'use client'

import { useMemo } from 'react'
import { Printer } from 'lucide-react'

interface CableItem {
  cable_ref: string
  package_name: string
  mvs: string | null
  overall_status: string
  completion_pct: number
  scope?: string
}

interface DailyLog {
  log_date: string
  total_manhours: number | null
  personnel?: { name: string; hours: number }[]
}

interface Props {
  siteName: string
  client: string
  cables: CableItem[]
  allLogs: DailyLog[]
}

const PKG_COLORS: Record<string, string> = {
  'AC Battery Cable':    '#3b82f6',
  '5C 70mm² Skid Cable': '#8b5cf6',
  'LV Power':            '#f59e0b',
  'Fibre Cable':         '#10b981',
  'Comms / Multicore':   '#ec4899',
  '33kV HV Cable':       '#ef4444',
}

export default function ProgressReport({ siteName, client, cables, allLogs }: Props) {
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const ipeCables = cables.filter(c => !c.scope || c.scope === 'IPE')
  const totalCables = ipeCables.length
  const completeCables = ipeCables.filter(c => c.overall_status === 'Complete').length
  const inProgressCables = ipeCables.filter(c => c.overall_status === 'In Progress').length
  const overallPct = totalCables ? Math.round((ipeCables.reduce((s, c) => s + (c.completion_pct ?? 0), 0) / totalCables) * 100) : 0
  const totalManhours = allLogs.reduce((s, l) => s + (l.total_manhours ?? 0), 0)
  const daysOnSite = allLogs.length

  // ── MVS completion ─────────────────────────────────────────────────────────
  const mvsOrder = ['MVS-1','MVS-2','MVS-3','MVS-4','MVS-5','MVS-6','MVS-7','MVS-8']
  const mvsGroups = useMemo(() => {
    const groups: Record<string, { complete: number; inProgress: number; total: number }> = {}
    for (const c of ipeCables) {
      const key = c.mvs ?? 'Other'
      if (!groups[key]) groups[key] = { complete: 0, inProgress: 0, total: 0 }
      groups[key].total++
      if (c.overall_status === 'Complete') groups[key].complete++
      else if (c.overall_status === 'In Progress') groups[key].inProgress++
    }
    return groups
  }, [ipeCables])

  const mvsKeys = mvsOrder.filter(k => mvsGroups[k])
  if (mvsGroups['Other']) mvsKeys.push('Other')

  // ── Package breakdown ──────────────────────────────────────────────────────
  const pkgGroups = useMemo(() => {
    const groups: Record<string, { total: number; complete: number; pct: number }> = {}
    for (const c of cables) {
      const k = c.package_name
      if (!groups[k]) groups[k] = { total: 0, complete: 0, pct: 0 }
      groups[k].total++
      if (c.overall_status === 'Complete') groups[k].complete++
    }
    for (const k of Object.keys(groups)) {
      groups[k].pct = groups[k].total ? Math.round((groups[k].complete / groups[k].total) * 100) : 0
    }
    return groups
  }, [cables])

  // ── Daily manhours (last 30 days with data) ────────────────────────────────
  const chartLogs = useMemo(() => {
    return [...allLogs]
      .sort((a, b) => a.log_date.localeCompare(b.log_date))
      .slice(-30)
  }, [allLogs])

  const maxHours = Math.max(...chartLogs.map(l => l.total_manhours ?? 0), 1)
  const chartW = 660
  const chartH = 100
  const barW = Math.max(8, Math.floor((chartW - 20) / Math.max(chartLogs.length, 1)) - 2)

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Progress Report — {siteName}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {client} · Generated {today}
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border hover:opacity-80 transition-opacity"
          style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
        >
          <Printer size={13} /> Print / Export
        </button>
      </div>

      <div className="p-6 space-y-6">

        {/* ── KPI row ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Overall Progress', value: `${overallPct}%`, sub: `${completeCables} of ${totalCables} cables`, color: '#3b82f6' },
            { label: 'In Progress', value: String(inProgressCables), sub: 'cables active', color: '#f59e0b' },
            { label: 'Manhours to Date', value: totalManhours.toLocaleString(), sub: `across ${daysOnSite} site days`, color: '#8b5cf6' },
            { label: 'Days on Site', value: String(daysOnSite), sub: `since ${allLogs.length ? new Date(allLogs.slice().sort((a,b) => a.log_date.localeCompare(b.log_date))[0].log_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}) : '—'}`, color: '#10b981' },
          ].map(k => (
            <div key={k.label} className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
              <div className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</div>
              <div className="text-xs font-medium mt-1" style={{ color: 'var(--text-primary)' }}>{k.label}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* ── MVS Completion bars ────────────────────────────────────────────── */}
        <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            MVS Completion — IPE Scope
          </h3>
          <div className="space-y-3">
            {mvsKeys.map(mvs => {
              const g = mvsGroups[mvs]
              const completePct = g.total ? (g.complete / g.total) * 100 : 0
              const inProgPct   = g.total ? (g.inProgress / g.total) * 100 : 0
              const overallPctVal = Math.round(completePct + inProgPct * 0.5)
              return (
                <div key={mvs} className="flex items-center gap-3">
                  <div className="w-14 text-xs font-medium text-right shrink-0" style={{ color: 'var(--text-primary)' }}>{mvs}</div>
                  <div className="flex-1 relative h-6 rounded-full overflow-hidden" style={{ background: 'var(--surface)' }}>
                    {/* Complete */}
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                      style={{ width: `${completePct}%`, background: '#22c55e' }}
                    />
                    {/* In progress */}
                    <div
                      className="absolute inset-y-0 rounded-full transition-all duration-500"
                      style={{ left: `${completePct}%`, width: `${inProgPct}%`, background: '#f59e0b' }}
                    />
                  </div>
                  <div className="w-32 text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                    <span className="font-semibold" style={{ color: '#22c55e' }}>{g.complete}</span>
                    {g.inProgress > 0 && <span className="font-semibold" style={{ color: '#f59e0b' }}> +{g.inProgress} WIP</span>}
                    <span> / {g.total}</span>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex gap-4 mt-4 pt-4 border-t text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#22c55e' }} /> Complete</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#f59e0b' }} /> In Progress</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ background: 'var(--surface)' , border: '1px solid var(--border)' }} /> Not Started</span>
          </div>
        </div>

        {/* ── Package breakdown ──────────────────────────────────────────────── */}
        <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Package Breakdown
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(pkgGroups).map(([pkg, g]) => {
              const color = PKG_COLORS[pkg] ?? '#6b7280'
              const r = 20
              const circ = 2 * Math.PI * r
              const dash = (g.pct / 100) * circ
              return (
                <div key={pkg} className="flex items-center gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                  <svg width="48" height="48" viewBox="0 0 48 48">
                    <circle cx="24" cy="24" r={r} fill="none" stroke="var(--surface)" strokeWidth="6" />
                    <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="6"
                      strokeDasharray={`${dash} ${circ}`}
                      strokeLinecap="round"
                      transform="rotate(-90 24 24)" />
                    <text x="24" y="28" textAnchor="middle" fontSize="10" fontWeight="bold" fill={color}>{g.pct}%</text>
                  </svg>
                  <div className="min-w-0">
                    <div className="text-xs font-medium leading-tight truncate" style={{ color: 'var(--text-primary)' }}>{pkg}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{g.complete}/{g.total} cables</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Daily manhours bar chart ───────────────────────────────────────── */}
        {chartLogs.length > 1 && (
          <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Daily Manhours — Last {chartLogs.length} Site Days
            </h3>
            <svg viewBox={`0 0 ${chartW} ${chartH + 28}`} className="w-full" style={{ maxHeight: 160 }}>
              {/* Y gridlines */}
              {[0.25, 0.5, 0.75, 1].map(f => (
                <g key={f}>
                  <line x1="0" y1={chartH - f * chartH} x2={chartW} y2={chartH - f * chartH}
                    stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3 3" />
                  <text x="0" y={chartH - f * chartH - 2} fontSize="8" fill="var(--text-muted)">{Math.round(f * maxHours)}</text>
                </g>
              ))}
              {/* Bars */}
              {chartLogs.map((log, i) => {
                const h = ((log.total_manhours ?? 0) / maxHours) * chartH
                const x = 20 + i * (barW + 2)
                const isRecent = i >= chartLogs.length - 7
                return (
                  <g key={log.log_date}>
                    <rect
                      x={x} y={chartH - h} width={barW} height={h}
                      rx="2"
                      fill={isRecent ? '#3b82f6' : '#3b82f680'}
                    />
                    {i % Math.max(1, Math.floor(chartLogs.length / 8)) === 0 && (
                      <text x={x + barW / 2} y={chartH + 12} fontSize="7" textAnchor="middle" fill="var(--text-muted)">
                        {new Date(log.log_date + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </text>
                    )}
                  </g>
                )
              })}
              {/* Baseline */}
              <line x1="0" y1={chartH} x2={chartW} y2={chartH} stroke="var(--border)" strokeWidth="1" />
            </svg>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Darker bars = last 7 days · Total: {totalManhours.toLocaleString()} manhours
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
