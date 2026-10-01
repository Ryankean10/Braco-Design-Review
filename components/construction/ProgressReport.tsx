'use client'

import { useMemo } from 'react'
import { Printer, HardHat, Zap } from 'lucide-react'

interface CableItem {
  cable_ref: string; package_name: string; mvs: string | null
  overall_status: string; completion_pct: number; scope?: string
}
interface DailyLog {
  log_date: string; total_manhours: number | null
  personnel?: { name: string; hours: number }[]
}
export interface CivilsActivity {
  activity_group: string; category: string; status: string; progress_pct: number
}

interface Props {
  siteName: string
  client: string
  cables: CableItem[]
  allLogs: DailyLog[]
  civilsActivities?: CivilsActivity[]
  reportDate?: string
}

const PKG_COLORS: Record<string, string> = {
  'AC Battery Cable':    '#3b82f6',
  '5C 70mm² Skid Cable': '#8b5cf6',
  'LV Power':            '#f59e0b',
  'Fibre Cable':         '#10b981',
  'Comms / Multicore':   '#ec4899',
  '33kV HV Cable':       '#ef4444',
}

export default function ProgressReport({ siteName, client, cables, allLogs, civilsActivities = [], reportDate }: Props) {
  const today = reportDate ?? new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  // ── Electrical / cable stats ─────────────────────────────────────────────
  const ipeCables       = cables.filter(c => !c.scope || c.scope === 'IPE')
  const totalCables     = ipeCables.length
  const completeCables  = ipeCables.filter(c => c.overall_status === 'Complete').length
  const inProgCables    = ipeCables.filter(c => c.overall_status === 'In Progress').length
  const blockedCables   = ipeCables.filter(c => c.overall_status === 'Blocked').length
  const cablePct        = totalCables
    ? Math.round((ipeCables.reduce((s, c) => s + (c.completion_pct ?? 0), 0) / totalCables) * 100)
    : 0
  const totalManhours   = allLogs.reduce((s, l) => s + (l.total_manhours ?? 0), 0)
  const daysOnSite      = allLogs.length
  const firstDay        = allLogs.length
    ? new Date(allLogs.slice().sort((a, b) => a.log_date.localeCompare(b.log_date))[0].log_date)
        .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'

  // ── Civils stats ─────────────────────────────────────────────────────────
  const civilsTotal    = civilsActivities.length
  const civilsComplete = civilsActivities.filter(a => a.status === 'Complete').length
  const civilsWip      = civilsActivities.filter(a => a.status === 'In Progress').length
  const civilsPct      = civilsTotal > 0
    ? Math.round(civilsActivities.reduce((s, a) => s + a.progress_pct, 0) / civilsTotal)
    : null
  const belowGround    = civilsActivities.filter(a => a.category === 'Below Ground')
  const aboveGround    = civilsActivities.filter(a => a.category === 'Above Ground')
  const belowPct       = belowGround.length > 0
    ? Math.round(belowGround.reduce((s, a) => s + a.progress_pct, 0) / belowGround.length) : 0
  const abovePct       = aboveGround.length > 0
    ? Math.round(aboveGround.reduce((s, a) => s + a.progress_pct, 0) / aboveGround.length) : 0

  // Blended overall
  const overallPct = civilsPct !== null ? Math.round((cablePct + civilsPct) / 2) : cablePct

  // ── MVS ──────────────────────────────────────────────────────────────────
  const mvsOrder  = ['MVS-1','MVS-2','MVS-3','MVS-4','MVS-5','MVS-6','MVS-7','MVS-8']
  const mvsGroups = useMemo(() => {
    const g: Record<string, { complete: number; inProgress: number; total: number }> = {}
    for (const c of ipeCables) {
      const k = c.mvs ?? 'Other'
      if (!g[k]) g[k] = { complete: 0, inProgress: 0, total: 0 }
      g[k].total++
      if (c.overall_status === 'Complete')    g[k].complete++
      else if (c.overall_status === 'In Progress') g[k].inProgress++
    }
    return g
  }, [ipeCables])
  const mvsKeys = mvsOrder.filter(k => mvsGroups[k])
  if (mvsGroups['Other']) mvsKeys.push('Other')

  // ── Package breakdown ─────────────────────────────────────────────────────
  const pkgGroups = useMemo(() => {
    const g: Record<string, { total: number; complete: number; pct: number }> = {}
    for (const c of cables) {
      const k = c.package_name
      if (!g[k]) g[k] = { total: 0, complete: 0, pct: 0 }
      g[k].total++
      if (c.overall_status === 'Complete') g[k].complete++
    }
    for (const k of Object.keys(g)) g[k].pct = g[k].total ? Math.round((g[k].complete / g[k].total) * 100) : 0
    return g
  }, [cables])

  // ── Manhours chart ───────────────────────────────────────────────────────
  const chartLogs = useMemo(() =>
    [...allLogs].sort((a, b) => a.log_date.localeCompare(b.log_date)).slice(-30),
    [allLogs])
  const maxHours = Math.max(...chartLogs.map(l => l.total_manhours ?? 0), 1)
  const chartW = 660, chartH = 100
  const barW   = Math.max(8, Math.floor((chartW - 20) / Math.max(chartLogs.length, 1)) - 2)

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
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
          style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
          <Printer size={13} /> Print / Export PDF
        </button>
      </div>

      <div className="p-6 space-y-6">

        {/* ── HERO — Civils | Electrical side by side ───────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Civils */}
          <div className="rounded-xl border p-5 space-y-4"
            style={{ borderColor: 'rgba(251,146,60,0.3)', background: 'rgba(251,146,60,0.04)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardHat size={16} style={{ color: '#fb923c' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Civils Works</span>
              </div>
              <span className="text-3xl font-bold" style={{ color: civilsPct === 100 ? '#22c55e' : '#fb923c' }}>
                {civilsPct !== null ? `${civilsPct}%` : '—'}
              </span>
            </div>

            {/* Overall civils bar */}
            {civilsPct !== null && (
              <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${civilsPct}%`, background: civilsPct === 100 ? '#22c55e' : '#fb923c' }} />
              </div>
            )}

            {/* Below / Above ground breakdown */}
            <div className="space-y-2.5">
              {[
                { label: 'Below Ground', pct: belowPct, acts: belowGround },
                { label: 'Above Ground', pct: abovePct, acts: aboveGround },
              ].map(({ label, pct, acts }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {acts.filter(a => a.status === 'Complete').length}/{acts.length} · {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: pct === 100 ? '#22c55e' : '#fb923c' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Activity list */}
            {civilsActivities.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {civilsActivities.map(a => (
                  <div key={a.activity_group} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: a.status === 'Complete' ? '#22c55e' : a.status === 'In Progress' ? '#fb923c' : '#94a3b8' }} />
                    <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{a.activity_group}</span>
                    <span className="tabular-nums shrink-0" style={{ color: 'var(--text-muted)' }}>{a.progress_pct}%</span>
                  </div>
                ))}
              </div>
            )}

            {civilsActivities.length === 0 && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No civils activities recorded</p>
            )}

            <div className="flex gap-3 pt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                {civilsComplete} complete
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#fb923c' }} />
                {civilsWip} WIP
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#94a3b8' }} />
                {civilsTotal - civilsComplete - civilsWip} not started
              </span>
            </div>
          </div>

          {/* Electrical */}
          <div className="rounded-xl border p-5 space-y-4"
            style={{ borderColor: 'rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.04)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap size={16} style={{ color: '#3b82f6' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Electrical / Cable</span>
              </div>
              <span className="text-3xl font-bold" style={{ color: cablePct === 100 ? '#22c55e' : '#3b82f6' }}>
                {cablePct}%
              </span>
            </div>

            {/* Overall cable bar */}
            <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
              <div className="h-full rounded-full transition-all"
                style={{ width: `${cablePct}%`, background: cablePct === 100 ? '#22c55e' : '#3b82f6' }} />
            </div>

            {/* Package mini-bars */}
            <div className="space-y-2.5">
              {Object.entries(pkgGroups).map(([pkg, g]) => (
                <div key={pkg}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="truncate" style={{ color: 'var(--text-muted)' }}>{pkg}</span>
                    <span className="shrink-0 ml-2" style={{ color: 'var(--text-muted)' }}>{g.complete}/{g.total} · {g.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full"
                      style={{ width: `${g.pct}%`, background: PKG_COLORS[pkg] ?? '#6b7280' }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              {[
                { label: 'Total cables', value: String(totalCables), color: 'var(--text-primary)' },
                { label: 'Complete',     value: String(completeCables), color: '#22c55e' },
                { label: 'In progress',  value: String(inProgCables), color: '#f59e0b' },
                { label: 'Blocked',      value: String(blockedCables), color: blockedCables > 0 ? '#f87171' : 'var(--text-muted)' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-lg p-2 text-center"
                  style={{ background: 'var(--bg-elevated)' }}>
                  <div className="text-lg font-bold" style={{ color }}>{value}</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Overall blended KPI strip ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Overall Progress', value: `${overallPct}%`,
              sub: civilsPct !== null ? `${cablePct}% cable · ${civilsPct}% civils` : `${completeCables} of ${totalCables} cables`,
              color: overallPct >= 80 ? '#22c55e' : '#3b82f6' },
            { label: 'Manhours to Date', value: totalManhours.toLocaleString(),
              sub: `across ${daysOnSite} site days`, color: '#8b5cf6' },
            { label: 'Days on Site',     value: String(daysOnSite),
              sub: `since ${firstDay}`, color: '#10b981' },
            { label: 'Cables In Progress', value: String(inProgCables),
              sub: `${blockedCables} blocked`, color: '#f59e0b' },
          ].map(k => (
            <div key={k.label} className="rounded-xl border p-4"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
              <div className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</div>
              <div className="text-xs font-medium mt-1" style={{ color: 'var(--text-primary)' }}>{k.label}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* ── MVS completion bars ───────────────────────────────────────────── */}
        {mvsKeys.length > 0 && (
          <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              MVS Completion — IPE Scope
            </h3>
            <div className="space-y-3">
              {mvsKeys.map(mvs => {
                const g           = mvsGroups[mvs]
                const completePct = g.total ? (g.complete / g.total) * 100 : 0
                const inProgPct   = g.total ? (g.inProgress / g.total) * 100 : 0
                return (
                  <div key={mvs} className="flex items-center gap-3">
                    <div className="w-14 text-xs font-medium text-right shrink-0" style={{ color: 'var(--text-primary)' }}>{mvs}</div>
                    <div className="flex-1 relative h-6 rounded-full overflow-hidden" style={{ background: 'var(--surface)' }}>
                      <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                        style={{ width: `${completePct}%`, background: '#22c55e' }} />
                      <div className="absolute inset-y-0 rounded-full transition-all duration-500"
                        style={{ left: `${completePct}%`, width: `${inProgPct}%`, background: '#f59e0b' }} />
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
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} /> Not Started</span>
            </div>
          </div>
        )}

        {/* ── Daily manhours chart ──────────────────────────────────────────── */}
        {chartLogs.length > 1 && (
          <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Daily Manhours — Last {chartLogs.length} Site Days
            </h3>
            <svg viewBox={`0 0 ${chartW} ${chartH + 28}`} className="w-full" style={{ maxHeight: 160 }}>
              {[0.25, 0.5, 0.75, 1].map(f => (
                <g key={f}>
                  <line x1="0" y1={chartH - f * chartH} x2={chartW} y2={chartH - f * chartH}
                    stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3 3" />
                  <text x="0" y={chartH - f * chartH - 2} fontSize="8" fill="var(--text-muted)">{Math.round(f * maxHours)}</text>
                </g>
              ))}
              {chartLogs.map((log, i) => {
                const h = ((log.total_manhours ?? 0) / maxHours) * chartH
                const x = 20 + i * (barW + 2)
                return (
                  <g key={log.log_date}>
                    <rect x={x} y={chartH - h} width={barW} height={h} rx="2"
                      fill={i >= chartLogs.length - 7 ? '#3b82f6' : '#3b82f680'} />
                    {i % Math.max(1, Math.floor(chartLogs.length / 8)) === 0 && (
                      <text x={x + barW / 2} y={chartH + 12} fontSize="7" textAnchor="middle" fill="var(--text-muted)">
                        {new Date(log.log_date + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </text>
                    )}
                  </g>
                )
              })}
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
