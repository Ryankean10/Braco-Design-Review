'use client'

import { useState } from 'react'
import { CheckCircle2, Clock, AlertCircle, CloudRain, Flag, Users, ChevronDown, ChevronUp, Plus, Wind, Thermometer, Droplets, AlertTriangle } from 'lucide-react'
import DailyLogForm from './DailyLogForm'

interface CableItem {
  id: string
  cable_ref: string
  package_name: string
  mvs: string | null
  overall_status: string
  completion_pct: number
  flagged: boolean
  scope?: string
}

interface PersonnelEntry {
  name: string
  role: string
  company?: string
  hours: number
  note?: string
}

interface IssueEntry {
  description: string
  impact: string
  status: string
  action?: string
}

interface DailyLog {
  id: string
  log_date: string
  total_manhours: number | null
  personnel: PersonnelEntry[]
  weather_description: string | null
  weather_conditions: string | null
  weather_impact: string | null
  weather_lost_hours: number | null
  temp_c: number | null
  wind_mph: number | null
  rain_mm: number | null
  issues: IssueEntry[]
  summary: string | null
}

interface Props {
  site: any
  cables: CableItem[]
  recentLogs: DailyLog[]
  reviewItemCount: number
  canEdit: boolean
}

const WEATHER_COLOR: Record<string, string> = {
  Good: '#4ade80', Fair: '#facc15', Poor: '#f87171',
}
const IMPACT_COLOR: Record<string, string> = {
  None: '#4ade80', Low: '#facc15', Medium: '#fb923c', High: '#f87171',
}

export default function SiteDashboard({ site, cables, recentLogs, reviewItemCount, canEdit }: Props) {
  const [showLogForm, setShowLogForm] = useState(false)
  const [expandedLog, setExpandedLog] = useState<string | null>(recentLogs[0]?.id ?? null)

  // Stats
  const ipeOnly = cables.filter(c => !c.scope || c.scope === 'IPE')
  const total    = ipeOnly.length
  const complete = ipeOnly.filter(c => c.overall_status === 'Complete').length
  const inProg   = ipeOnly.filter(c => c.overall_status === 'In Progress').length
  const blocked  = ipeOnly.filter(c => c.overall_status === 'Blocked').length
  const flagged  = cables.filter(c => c.flagged && c.scope === 'IPE').length
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0

  // Package rollup (IPE only)
  const byPkg: Record<string, { total: number; complete: number; inProg: number }> = {}
  ipeOnly.forEach(c => {
    const p = c.package_name ?? 'Unknown'
    if (!byPkg[p]) byPkg[p] = { total: 0, complete: 0, inProg: 0 }
    byPkg[p].total++
    if (c.overall_status === 'Complete')    byPkg[p].complete++
    if (c.overall_status === 'In Progress') byPkg[p].inProg++
  })

  // MVS rollup
  const byMvs: Record<string, { total: number; complete: number }> = {}
  cables.filter(c => c.mvs && c.package_name === 'AC Battery Cable').forEach(c => {
    const m = c.mvs!
    if (!byMvs[m]) byMvs[m] = { total: 0, complete: 0 }
    byMvs[m].total++
    if (c.overall_status === 'Complete') byMvs[m].complete++
  })

  // 7-day manhours
  const totalManhours7d = recentLogs.reduce((s, l) => s + (l.total_manhours ?? 0), 0)
  const latestLog = recentLogs[0] ?? null

  // Open issues across all logs
  const openIssues = recentLogs.flatMap(l => (l.issues ?? []).filter((i: IssueEntry) => i.status === 'Open'))

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Overall progress" value={`${pct}%`} sub={`${complete}/${total} cables`} color={pct === 100 ? '#4ade80' : 'var(--accent)'} />
        <Kpi label="In progress" value={String(inProg)} sub="cables active" color="#60a5fa" />
        <Kpi label="Blocked" value={String(blocked)} sub="need action" color={blocked > 0 ? '#f87171' : 'var(--text-muted)'} highlight={blocked > 0} />
        <Kpi label="Flagged / Review" value={String(flagged + reviewItemCount)} sub="items" color={flagged + reviewItemCount > 0 ? '#fb923c' : 'var(--text-muted)'} highlight={flagged + reviewItemCount > 0} />
        <Kpi label="Manhours (7d)" value={totalManhours7d.toFixed(0)} sub="logged hours" color="var(--text-primary)" />
      </div>

      {/* Today's weather + personnel (latest log) */}
      {latestLog && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Weather */}
          <div className="rounded-xl border p-5" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Weather — {new Date(latestLog.log_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
              </p>
              {latestLog.weather_conditions && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ color: WEATHER_COLOR[latestLog.weather_conditions] ?? 'var(--text-muted)', background: 'var(--bg-elevated)' }}>
                  {latestLog.weather_conditions}
                </span>
              )}
            </div>
            {latestLog.weather_description && (
              <p className="text-sm mb-3" style={{ color: 'var(--text-primary)' }}>{latestLog.weather_description}</p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {latestLog.temp_c != null && (
                <WeatherStat icon={<Thermometer size={12} />} label="Temp" value={`${latestLog.temp_c}°C`} />
              )}
              {latestLog.wind_mph != null && (
                <WeatherStat icon={<Wind size={12} />} label="Wind" value={`${latestLog.wind_mph} mph`} />
              )}
              {latestLog.rain_mm != null && (
                <WeatherStat icon={<Droplets size={12} />} label="Rain" value={`${latestLog.rain_mm} mm`} />
              )}
              {latestLog.weather_lost_hours != null && latestLog.weather_lost_hours > 0 && (
                <WeatherStat icon={<Clock size={12} />} label="Lost hrs" value={`${latestLog.weather_lost_hours}h`} color="#f87171" />
              )}
              {latestLog.weather_impact && (
                <WeatherStat icon={<AlertCircle size={12} />} label="Impact"
                  value={latestLog.weather_impact}
                  color={IMPACT_COLOR[latestLog.weather_impact] ?? 'var(--text-muted)'} />
              )}
            </div>
          </div>

          {/* Personnel */}
          <div className="rounded-xl border p-5" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Personnel — {new Date(latestLog.log_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
              </p>
              <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>
                {latestLog.total_manhours ?? 0}h total
              </span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {(latestLog.personnel ?? []).map((p: PersonnelEntry, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs rounded-lg px-2 py-1.5"
                  style={{ background: 'var(--bg-elevated)' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                      style={{ background: 'var(--accent)' }}>
                      {p.name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                      {p.note && <p className="text-[10px] truncate" style={{ color: '#fb923c' }}>{p.note}</p>}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p style={{ color: 'var(--text-muted)' }}>{p.role}</p>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{p.hours}h</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Open issues */}
      {openIssues.length > 0 && (
        <div className="rounded-xl border p-4" style={{ background: 'var(--bg-surface)', borderColor: 'rgba(251,146,60,0.3)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: '#fb923c' }}>
            <AlertTriangle size={12} /> Open issues ({openIssues.length})
          </p>
          <div className="space-y-2">
            {openIssues.map((issue: IssueEntry, i: number) => (
              <div key={i} className="flex items-start gap-3 text-xs rounded-lg p-2.5" style={{ background: 'var(--bg-elevated)' }}>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 mt-0.5"
                  style={{ background: IMPACT_COLOR[issue.impact] ? IMPACT_COLOR[issue.impact] + '22' : 'var(--bg-elevated)', color: IMPACT_COLOR[issue.impact] ?? 'var(--text-muted)' }}>
                  {issue.impact}
                </span>
                <div className="flex-1 min-w-0">
                  <p style={{ color: 'var(--text-primary)' }}>{issue.description}</p>
                  {issue.action && <p className="mt-0.5" style={{ color: 'var(--text-muted)' }}>→ {issue.action}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Package progress */}
      <div className="rounded-xl border p-5" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>Package progress (IPE scope)</p>
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

      {/* MVS grid */}
      {Object.keys(byMvs).length > 0 && (
        <div className="rounded-xl border p-5" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>MVS status — AC battery cables</p>
          <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
            {Object.entries(byMvs).sort(([a],[b]) => a.localeCompare(b, undefined, { numeric: true })).map(([mvs, stats]) => {
              const p = stats.total > 0 ? (stats.complete / stats.total) * 100 : 0
              const inP = cables.filter(c => c.mvs === mvs && c.overall_status === 'In Progress').length
              return (
                <div key={mvs} className="rounded-lg border p-3 text-center"
                  style={{ borderColor: p === 100 ? 'rgba(74,222,128,0.4)' : inP > 0 ? 'rgba(96,165,250,0.3)' : 'var(--border)',
                    background: p === 100 ? 'rgba(74,222,128,0.06)' : 'var(--bg-elevated)' }}>
                  <p className="text-xs font-semibold" style={{ color: p === 100 ? '#4ade80' : 'var(--text-primary)' }}>{mvs}</p>
                  <p className="text-lg font-bold mt-1" style={{ color: p === 100 ? '#4ade80' : 'var(--accent)' }}>{p.toFixed(0)}%</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{stats.complete}/{stats.total}</p>
                  {inP > 0 && <p className="text-[9px] mt-0.5" style={{ color: '#60a5fa' }}>{inP} active</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Daily logs history */}
      <div className="rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Daily logs</p>
          {canEdit && (
            <button onClick={() => setShowLogForm(v => !v)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
              style={{ color: 'var(--accent)', borderColor: 'var(--accent)', background: 'transparent' }}>
              <Plus size={12} /> Log today
            </button>
          )}
        </div>

        {showLogForm && canEdit && (
          <div className="border-b p-5" style={{ borderColor: 'var(--border)' }}>
            <DailyLogForm siteId={site.id} onSaved={() => setShowLogForm(false)} />
          </div>
        )}

        <div className="divide-y" style={{ divideColor: 'var(--border)' }}>
          {recentLogs.length === 0 && (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No daily logs yet</p>
          )}
          {recentLogs.map(log => {
            const isOpen = expandedLog === log.id
            const personnel: PersonnelEntry[] = log.personnel ?? []
            const issues: IssueEntry[] = log.issues ?? []
            const openCount = issues.filter(i => i.status === 'Open').length
            return (
              <div key={log.id}>
                <button className="w-full flex items-center justify-between px-5 py-3 text-left hover:opacity-80 transition-opacity"
                  onClick={() => setExpandedLog(isOpen ? null : log.id)}>
                  <div className="flex items-center gap-4">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {new Date(log.log_date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: '2-digit' })}
                    </p>
                    {log.weather_conditions && (
                      <span className="text-xs" style={{ color: WEATHER_COLOR[log.weather_conditions] ?? 'var(--text-muted)' }}>
                        {log.weather_description ?? log.weather_conditions}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {personnel.length > 0 && (
                      <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                        <Users size={11} /> {personnel.length} · {log.total_manhours}h
                      </span>
                    )}
                    {openCount > 0 && (
                      <span className="text-xs flex items-center gap-1" style={{ color: '#fb923c' }}>
                        <AlertTriangle size={11} /> {openCount}
                      </span>
                    )}
                    {isOpen ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-4 space-y-3">
                    {log.summary && (
                      <p className="text-xs leading-relaxed rounded-lg p-3" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                        {log.summary}
                      </p>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Personnel breakdown */}
                      {personnel.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Personnel</p>
                          <div className="space-y-1">
                            {personnel.map((p, i) => (
                              <div key={i} className="flex justify-between text-xs px-2 py-1 rounded" style={{ background: 'var(--bg-elevated)' }}>
                                <div>
                                  <span style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                                  <span className="ml-1.5" style={{ color: 'var(--text-muted)' }}>{p.role}</span>
                                  {p.note && <span className="ml-1.5" style={{ color: '#fb923c' }}>— {p.note}</span>}
                                </div>
                                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{p.hours}h</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Issues */}
                      {issues.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Issues</p>
                          <div className="space-y-1">
                            {issues.map((issue, i) => (
                              <div key={i} className="text-xs px-2 py-1.5 rounded" style={{ background: 'var(--bg-elevated)' }}>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-semibold px-1 rounded"
                                    style={{ color: IMPACT_COLOR[issue.impact] ?? 'var(--text-muted)', background: 'var(--bg-surface)' }}>
                                    {issue.impact}
                                  </span>
                                  <span className="text-[10px]" style={{ color: issue.status === 'Open' ? '#fb923c' : '#4ade80' }}>
                                    {issue.status}
                                  </span>
                                </div>
                                <p className="mt-0.5" style={{ color: 'var(--text-primary)' }}>{issue.description}</p>
                                {issue.action && <p className="mt-0.5" style={{ color: 'var(--text-muted)' }}>→ {issue.action}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, value, sub, color, highlight }: { label: string; value: string; sub: string; color: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border p-4" style={{ background: 'var(--bg-surface)', borderColor: highlight ? color + '66' : 'var(--border)' }}>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-3xl font-bold mt-1" style={{ color }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>
    </div>
  )
}

function WeatherStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg p-2 text-center" style={{ background: 'var(--bg-elevated)' }}>
      <div className="flex items-center justify-center gap-1 mb-0.5" style={{ color: color ?? 'var(--text-muted)' }}>
        {icon}
        <span className="text-[10px]">{label}</span>
      </div>
      <p className="text-xs font-semibold" style={{ color: color ?? 'var(--text-primary)' }}>{value}</p>
    </div>
  )
}
