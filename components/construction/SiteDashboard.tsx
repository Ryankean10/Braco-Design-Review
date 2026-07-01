'use client'

import { useState } from 'react'
import { CheckCircle2, Clock, AlertCircle, Users, CloudRain, Flag, TrendingUp } from 'lucide-react'

interface CableItem {
  id: string
  cable_ref: string
  package_name: string
  mvs: string | null
  overall_status: string
  completion_pct: number
  cable_size: string | null
  flagged: boolean
}

interface DailyLog {
  log_date: string
  total_manhours: number | null
  weather_impact: string | null
  weather_description: string | null
}

interface Props {
  site: any
  cables: CableItem[]
  recentLogs: DailyLog[]
  reviewItemCount: number
  canEdit: boolean
}

const STATUS_COLOR: Record<string, string> = {
  'Complete':    '#4ade80',
  'In Progress': '#60a5fa',
  'Blocked':     '#f87171',
  'Rework':      '#fb923c',
  'Not Started': '#475569',
}

export default function SiteDashboard({ site, cables, recentLogs, reviewItemCount, canEdit }: Props) {
  // Overall stats
  const total    = cables.length
  const complete = cables.filter(c => c.overall_status === 'Complete').length
  const inProg   = cables.filter(c => c.overall_status === 'In Progress').length
  const blocked  = cables.filter(c => c.overall_status === 'Blocked').length
  const flagged  = cables.filter(c => c.flagged).length
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0

  // Per-package rollup
  const byPkg: Record<string, { total: number; complete: number; inProg: number }> = {}
  cables.forEach(c => {
    const p = c.package_name ?? 'Unknown'
    if (!byPkg[p]) byPkg[p] = { total: 0, complete: 0, inProg: 0 }
    byPkg[p].total++
    if (c.overall_status === 'Complete')    byPkg[p].complete++
    if (c.overall_status === 'In Progress') byPkg[p].inProg++
  })

  // Per-MVS rollup (AC battery cables only)
  const byMvs: Record<string, { total: number; complete: number }> = {}
  cables.filter(c => c.mvs && c.package_name === 'AC Battery Cable').forEach(c => {
    const m = c.mvs!
    if (!byMvs[m]) byMvs[m] = { total: 0, complete: 0 }
    byMvs[m].total++
    if (c.overall_status === 'Complete') byMvs[m].complete++
  })

  const totalManhours = recentLogs.reduce((s, l) => s + (l.total_manhours ?? 0), 0)

  return (
    <div className="space-y-4">
      {/* Top KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-xl border p-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Overall progress</p>
          <p className="text-3xl font-bold mt-1" style={{ color: pct === 100 ? '#4ade80' : 'var(--accent)' }}>{pct}%</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{complete}/{total} cables</p>
        </div>
        <div className="rounded-xl border p-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>In progress</p>
          <p className="text-3xl font-bold mt-1" style={{ color: '#60a5fa' }}>{inProg}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>cables active</p>
        </div>
        <div className="rounded-xl border p-4" style={{ background: 'var(--bg-surface)', borderColor: blocked > 0 ? 'rgba(248,113,113,0.4)' : 'var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Blocked</p>
          <p className="text-3xl font-bold mt-1" style={{ color: blocked > 0 ? '#f87171' : 'var(--text-muted)' }}>{blocked}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>need action</p>
        </div>
        <div className="rounded-xl border p-4" style={{ background: 'var(--bg-surface)', borderColor: flagged + reviewItemCount > 0 ? 'rgba(251,146,60,0.4)' : 'var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Flagged / Review</p>
          <p className="text-3xl font-bold mt-1" style={{ color: flagged + reviewItemCount > 0 ? '#fb923c' : 'var(--text-muted)' }}>{flagged + reviewItemCount}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>items</p>
        </div>
        <div className="rounded-xl border p-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Manhours (7d)</p>
          <p className="text-3xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{totalManhours.toFixed(0)}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>logged hours</p>
        </div>
      </div>

      {/* Package progress bars */}
      <div className="rounded-xl border p-5" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>Package progress</p>
        <div className="space-y-3">
          {Object.entries(byPkg).map(([pkg, stats]) => {
            const p = stats.total > 0 ? (stats.complete / stats.total) * 100 : 0
            return (
              <div key={pkg}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{pkg}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{stats.complete}/{stats.total} · {p.toFixed(0)}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${p}%`, background: p === 100 ? '#4ade80' : 'var(--accent)' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* MVS status grid */}
      {Object.keys(byMvs).length > 0 && (
        <div className="rounded-xl border p-5" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>MVS status — AC battery cables</p>
          <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
            {Object.entries(byMvs).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([mvs, stats]) => {
              const p = stats.total > 0 ? (stats.complete / stats.total) * 100 : 0
              const isDone = p === 100
              return (
                <div key={mvs} className="rounded-lg border p-3 text-center"
                  style={{ borderColor: isDone ? 'rgba(74,222,128,0.4)' : 'var(--border)', background: isDone ? 'rgba(74,222,128,0.06)' : 'var(--bg-elevated)' }}>
                  <p className="text-xs font-semibold" style={{ color: isDone ? '#4ade80' : 'var(--text-primary)' }}>{mvs}</p>
                  <p className="text-lg font-bold mt-1" style={{ color: isDone ? '#4ade80' : 'var(--accent)' }}>{p.toFixed(0)}%</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{stats.complete}/{stats.total}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent weather / issues strip */}
      {recentLogs.length > 0 && (
        <div className="rounded-xl border p-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Recent daily logs</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recentLogs.map(log => {
              const impactColor = log.weather_impact === 'High' ? '#f87171' : log.weather_impact === 'Medium' ? '#fb923c' : log.weather_impact === 'Low' ? '#facc15' : '#4ade80'
              return (
                <div key={log.log_date} className="flex-shrink-0 rounded-lg border p-3 min-w-[100px]"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                  <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                    {new Date(log.log_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </p>
                  {log.total_manhours != null && (
                    <p className="text-sm font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{log.total_manhours}h</p>
                  )}
                  {log.weather_impact && log.weather_impact !== 'None' && (
                    <p className="text-[10px] mt-0.5 flex items-center gap-0.5" style={{ color: impactColor }}>
                      <CloudRain size={9} /> {log.weather_impact}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
