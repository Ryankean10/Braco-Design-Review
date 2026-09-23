'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  CheckCircle2, Clock, AlertCircle, CloudRain, Flag, Users,
  ChevronDown, ChevronUp, Plus, Wind, Thermometer, Droplets,
  AlertTriangle, BarChart2, ChevronRight, HardHat, Zap,
} from 'lucide-react'
import DailyLogForm from './DailyLogForm'

interface CableItem {
  id: string; cable_ref: string; package_name: string; mvs: string | null
  overall_status: string; completion_pct: number; flagged: boolean; scope?: string
}
interface PersonnelEntry { name: string; role: string; company?: string; hours: number; note?: string; person_id?: string }
interface IssueEntry { description: string; impact: string; status: string; action?: string }
interface DailyLog {
  id: string; log_date: string; total_manhours: number | null; personnel: PersonnelEntry[]
  weather_description: string | null; weather_conditions: string | null; weather_impact: string | null
  weather_lost_hours: number | null; temp_c: number | null; wind_mph: number | null; rain_mm: number | null
  issues: IssueEntry[]; summary: string | null
}
interface CivilsActivity { status: string; progress_pct: number; category: string; discipline?: string }

interface Props {
  site: any; siteId: string; cables: CableItem[]; recentLogs: DailyLog[]
  reviewItemCount: number; canEdit: boolean; civilsActivities?: CivilsActivity[]
  unmatchedPersonnel?: string[]
  nameToPersonId?: Record<string, string>
  highlightDate?: string
}

const WEATHER_COLOR: Record<string, string> = { Good: '#4ade80', Fair: '#facc15', Poor: '#f87171' }
const IMPACT_COLOR: Record<string, string> = { None: '#4ade80', Low: '#facc15', Medium: '#fb923c', High: '#f87171' }

function Section({ title, badge, badgeColor, summary, defaultOpen = false, id, forceOpen, children }: {
  title: string; badge?: string | number; badgeColor?: string
  summary?: React.ReactNode; defaultOpen?: boolean; id?: string; forceOpen?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen])

  return (
    <div id={id} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wider shrink-0" style={{ color: 'var(--text-muted)' }}>{title}</span>
          {badge !== undefined && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
              style={{ background: badgeColor ? badgeColor + '22' : 'var(--bg-elevated)', color: badgeColor ?? 'var(--text-muted)' }}>
              {badge}
            </span>
          )}
          {!open && summary && (
            <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{summary}</span>
          )}
        </div>
        {open
          ? <ChevronUp size={14} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
          : <ChevronRight size={14} className="shrink-0" style={{ color: 'var(--text-muted)' }} />}
      </button>
      {open && <div className="border-t px-5 py-4" style={{ borderColor: 'var(--border)' }}>{children}</div>}
    </div>
  )
}

export default function SiteDashboard({ site, siteId, cables, recentLogs, reviewItemCount, canEdit, civilsActivities = [], unmatchedPersonnel = [], nameToPersonId = {}, highlightDate }: Props) {
  const [logs, setLogs] = useState<DailyLog[]>(recentLogs)
  const [showLogForm, setShowLogForm] = useState(false)
  const [progressOpen, setProgressOpen] = useState(false)
  const [expandedLog, setExpandedLog] = useState<string | null>(
    highlightDate ? (recentLogs.find(l => l.log_date === highlightDate)?.id ?? null) : null
  )

  async function refreshLogs() {
    try {
      const res = await fetch(`/api/construction/sites/${siteId}/daily-log?limit=30`)
      if (res.ok) setLogs(await res.json())
    } catch {}
  }
  const highlightRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (highlightDate && highlightRef.current) {
      setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400)
    }
  }, [highlightDate])

  // Cable stats
  const ipeOnly   = cables.filter(c => !c.scope || c.scope === 'IPE')
  const total     = ipeOnly.length
  const complete  = ipeOnly.filter(c => c.overall_status === 'Complete').length
  const inProg    = ipeOnly.filter(c => c.overall_status === 'In Progress').length
  const blocked   = ipeOnly.filter(c => c.overall_status === 'Blocked').length
  const flagged   = cables.filter(c => c.flagged && c.scope === 'IPE').length
  const cablePct  = total > 0 ? Math.round((complete / total) * 100) : 0

  // Activity stats by discipline
  const avg = (acts: typeof civilsActivities) =>
    acts.length > 0 ? Math.round(acts.reduce((s, a) => s + a.progress_pct, 0) / acts.length) : null

  const civilsOnly   = civilsActivities.filter(a => !a.discipline || a.discipline === 'Civils')
  const electricalActs = civilsActivities.filter(a => a.discipline === 'Electrical' || a.discipline === 'HV')
  const commActs     = civilsActivities.filter(a => a.discipline === 'Commissioning')

  const civilsPct      = avg(civilsOnly)
  // Electrical % always driven by ITP/programme activities — cables are a manpower metric, not a project metric
  const electricalPct  = avg(electricalActs)
  const commPct        = avg(commActs)

  // Overall = average of whichever disciplines have data
  const disciplinePcts = [civilsPct, electricalPct, commPct].filter(p => p !== null) as number[]
  const overallPct = disciplinePcts.length > 0
    ? Math.round(disciplinePcts.reduce((s, p) => s + p, 0) / disciplinePcts.length)
    : 0

  const pctParts = [
    civilsPct !== null ? `civils ${civilsPct}%` : null,
    electricalPct !== null ? `electrical ${electricalPct}%` : null,
    commPct !== null ? `commissioning ${commPct}%` : null,
  ].filter(Boolean)
  const pctLabel = pctParts.length > 0 ? pctParts.join(' · ') : 'no activities seeded'

  // Package rollup
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

  const totalManhours7d = logs.reduce((s, l) => s + (l.total_manhours ?? 0), 0)
  const latestLog = logs[0] ?? null
  const openIssues = logs.flatMap(l => (l.issues ?? []).filter((i: IssueEntry) => i.status === 'Open'))

  return (
    <div className="space-y-3">

      {/* ── Personnel flag — diary names not matched to appointed staff ── */}
      {unmatchedPersonnel.length > 0 && (
        <div className="rounded-xl border px-4 py-3 flex items-start gap-3"
          style={{ borderColor: '#fb923c44', background: '#fb923c11' }}>
          <AlertTriangle size={15} className="shrink-0 mt-0.5" style={{ color: '#fb923c' }} />
          <div className="min-w-0">
            <p className="text-xs font-semibold" style={{ color: '#fb923c' }}>Unrecognised site personnel in recent diaries</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              These names appear in diary records but are not matched to appointed staff.{' '}
              <a href="#personnel-matching" className="underline" style={{ color: '#fb923c' }}>Open matching panel</a> to resolve:&nbsp;
              <span style={{ color: 'var(--text-primary)' }}>{unmatchedPersonnel.join(', ')}</span>
            </p>
          </div>
        </div>
      )}

      {/* ── KPI strip — always visible ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Overall progress" value={`${overallPct}%`} sub={pctLabel}
          color={overallPct === 100 ? '#4ade80' : 'var(--accent)'}
          hint="View progress breakdown"
          onClick={() => {
            setProgressOpen(true)
            setTimeout(() => document.getElementById('progress-breakdown')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
          }} />
        <Kpi label="Cables in progress" value={String(inProg)} sub="active"
          color="#60a5fa" href={`?status=In+Progress#cable-register`} hint="Filter in-progress cables" />
        <Kpi label="Blocked" value={String(blocked)} sub="need action"
          color={blocked > 0 ? '#f87171' : 'var(--text-muted)'} highlight={blocked > 0}
          href={`?status=Blocked#cable-register`} hint="View blocked cables" />
        <Kpi label="Flagged / Review" value={String(flagged + reviewItemCount)} sub="items"
          color={flagged + reviewItemCount > 0 ? '#fb923c' : 'var(--text-muted)'}
          highlight={flagged + reviewItemCount > 0}
          href={`?flagged=true#cable-register`} hint="View flagged cables" />
        <Kpi label="Manhours (7d)" value={totalManhours7d.toFixed(0)} sub="logged hours"
          color="var(--text-primary)"
          href={`/construction/${siteId}/analytics`} hint="View manpower analytics" />
        <Kpi label="Analytics" value="→" sub="crew · weather · trends"
          color="var(--accent)"
          href={`/construction/${siteId}/analytics`} hint="Open analytics" icon={<BarChart2 size={14} />} />
      </div>

      {/* ── Open issues — starts open only if there are issues ── */}
      {openIssues.length > 0 && (
        <Section title="Open issues" badge={openIssues.length} badgeColor="#fb923c"
          summary={openIssues.map(i => i.impact).join(' · ')}>
          <div className="space-y-2">
            {openIssues.map((issue: IssueEntry, i: number) => (
              <div key={i} className="flex items-start gap-3 text-xs rounded-lg p-2.5"
                style={{ background: 'var(--bg-elevated)' }}>
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
        </Section>
      )}

      {/* ── Progress breakdown — side by side ── */}
      <Section title="Progress breakdown" badge={`${overallPct}% overall`} badgeColor="var(--accent)"
        id="progress-breakdown" forceOpen={progressOpen}
        summary={pctLabel + (complete > 0 || total > 0 ? ` · ${complete}/${total} cables` : '')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Civils card */}
          {civilsPct !== null && (
            <Link href={`/construction/${siteId}#civils`}
              className="rounded-lg border p-4 hover:opacity-80 transition-opacity block"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                  <HardHat size={12} style={{ color: '#fb923c' }} /> Civils Works
                </span>
                <span className="text-lg font-bold" style={{ color: civilsPct === 100 ? '#4ade80' : '#fb923c' }}>{civilsPct}%</span>
              </div>
              <div className="space-y-2">
                {(['Below Ground', 'Above Ground'] as const).map(cat => {
                  const acts = civilsOnly.filter(a => a.category === cat)
                  if (!acts.length) return null
                  const p = Math.round(acts.reduce((s, a) => s + a.progress_pct, 0) / acts.length)
                  const done = acts.filter(a => a.status === 'Complete').length
                  return (
                    <div key={cat}>
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: 'var(--text-muted)' }}>{cat}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{done}/{acts.length} · {p}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                        <div className="h-full rounded-full" style={{ width: `${p}%`, background: p === 100 ? '#4ade80' : '#fb923c' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-[10px] mt-2.5" style={{ color: 'var(--text-muted)' }}>
                {civilsOnly.filter(a => a.status === 'Complete').length}/{civilsOnly.length} activities complete · click to view register
              </p>
            </Link>
          )}

          {/* Electrical card — always driven by ITP/programme activities */}
          {electricalActs.length > 0 && (
            <Link href={`/construction/${siteId}#civils`}
              className="rounded-lg border p-4 hover:opacity-80 transition-opacity block"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                  <Zap size={12} style={{ color: 'var(--accent)' }} /> Electrical Works
                </span>
                <span className="text-lg font-bold" style={{ color: electricalPct === 100 ? '#4ade80' : 'var(--accent)' }}>{electricalPct ?? 0}%</span>
              </div>
              <div className="space-y-2">
                {['Electrical', 'HV'].map(disc => {
                  const acts = civilsActivities.filter(a => a.discipline === disc)
                  if (!acts.length) return null
                  const p = Math.round(acts.reduce((s, a) => s + a.progress_pct, 0) / acts.length)
                  const done = acts.filter(a => a.status === 'Complete').length
                  return (
                    <div key={disc}>
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: 'var(--text-muted)' }}>{disc}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{done}/{acts.length} · {p}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                        <div className="h-full rounded-full" style={{ width: `${p}%`, background: p === 100 ? '#4ade80' : 'var(--accent)' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-[10px] mt-2.5" style={{ color: 'var(--text-muted)' }}>
                {electricalActs.filter(a => a.status === 'Complete').length}/{electricalActs.length} ITP activities complete · click to view register
              </p>
            </Link>
          )}

          {/* Cable packages */}
          <div className="rounded-lg border p-4"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Cable Packages (IPE)</span>
              <span className="text-lg font-bold" style={{ color: cablePct === 100 ? '#4ade80' : 'var(--accent)' }}>{cablePct}%</span>
            </div>
            <div className="space-y-2.5">
              {Object.entries(byPkg).map(([pkg, stats]) => {
                const p = stats.total > 0 ? (stats.complete / stats.total) * 100 : 0
                return (
                  <Link key={pkg} href={`/construction/${siteId}?package=${encodeURIComponent(pkg)}#cable-register`}
                    className="block hover:opacity-80 transition-opacity">
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: 'var(--text-primary)' }}>{pkg}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{stats.complete}/{stats.total} · {p.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                      <div className="h-full rounded-full"
                        style={{ width: `${p}%`, background: p === 100 ? '#4ade80' : 'var(--accent)' }} />
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </Section>

      {/* ── MVS grid ── */}
      {Object.keys(byMvs).length > 0 && (
        <Section title="MVS status — AC battery cables"
          summary={`${Object.values(byMvs).filter(m => m.complete === m.total && m.total > 0).length}/${Object.keys(byMvs).length} MVS complete · ${Object.values(byMvs).reduce((s, m) => s + m.complete, 0)}/${Object.values(byMvs).reduce((s, m) => s + m.total, 0)} cables`}>
          <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
            {Object.entries(byMvs).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([mvs, stats]) => {
              const p = stats.total > 0 ? (stats.complete / stats.total) * 100 : 0
              const inP = cables.filter(c => c.mvs === mvs && c.overall_status === 'In Progress').length
              return (
                <Link key={mvs}
                  href={`/construction/${siteId}?mvs=${encodeURIComponent(mvs)}#cable-register`}
                  className="rounded-lg border p-3 text-center hover:opacity-80 transition-opacity"
                  style={{
                    borderColor: p === 100 ? 'rgba(74,222,128,0.4)' : inP > 0 ? 'rgba(96,165,250,0.3)' : 'var(--border)',
                    background: p === 100 ? 'rgba(74,222,128,0.06)' : 'var(--bg-elevated)',
                  }}>
                  <p className="text-xs font-semibold" style={{ color: p === 100 ? '#4ade80' : 'var(--text-primary)' }}>{mvs}</p>
                  <p className="text-lg font-bold mt-1" style={{ color: p === 100 ? '#4ade80' : 'var(--accent)' }}>{p.toFixed(0)}%</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{stats.complete}/{stats.total}</p>
                  {inP > 0 && <p className="text-[9px] mt-0.5" style={{ color: '#60a5fa' }}>{inP} active</p>}
                </Link>
              )
            })}
          </div>
        </Section>
      )}

      {/* ── Weather & Personnel ── */}
      {latestLog && (
        <Section title="Weather & personnel"
          badge={new Date(latestLog.log_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
          summary={[latestLog.weather_conditions, latestLog.temp_c != null ? `${latestLog.temp_c}°C` : null, latestLog.personnel?.length ? `${latestLog.personnel.length} on site · ${latestLog.total_manhours ?? 0}h` : null].filter(Boolean).join(' · ')}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Weather */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Weather</p>
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
                {latestLog.temp_c != null && <WeatherStat icon={<Thermometer size={12} />} label="Temp" value={`${latestLog.temp_c}°C`} />}
                {latestLog.wind_mph != null && <WeatherStat icon={<Wind size={12} />} label="Wind" value={`${latestLog.wind_mph} mph`} />}
                {latestLog.rain_mm != null && <WeatherStat icon={<Droplets size={12} />} label="Rain" value={`${latestLog.rain_mm} mm`} />}
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
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Personnel</p>
                <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>
                  {latestLog.total_manhours ?? 0}h total
                </span>
              </div>
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {(latestLog.personnel ?? []).map((p: PersonnelEntry, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs rounded-lg px-2 py-1.5"
                    style={{ background: 'var(--bg-elevated)' }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                        style={{ background: 'var(--accent)' }}>
                        {p.name[0]}
                      </div>
                      <div className="min-w-0">
                        {(nameToPersonId[p.name] ?? p.person_id) ? (
                          <Link href={`/team?person=${nameToPersonId[p.name] ?? p.person_id}`}
                            className="font-medium truncate hover:underline"
                            style={{ color: 'var(--accent)' }}>
                            {p.name}
                          </Link>
                        ) : (
                          <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                        )}
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
        </Section>
      )}

      {/* ── Daily logs ── */}
      <Section title="Daily logs" badge={logs.length > 0 ? logs.length : undefined}
        defaultOpen={!!highlightDate}
        summary={latestLog ? `last: ${new Date(latestLog.log_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}${openIssues.length > 0 ? ` · ${openIssues.length} open issue${openIssues.length > 1 ? 's' : ''}` : ''}` : 'no logs yet'}>
        <div className="space-y-0 -mx-5 -mb-4">
          {canEdit && (
            <div className="px-5 pb-4">
              <button onClick={() => setShowLogForm(v => !v)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
                style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>
                <Plus size={12} /> Log today
              </button>
              {showLogForm && (
                <div className="mt-3">
                  <DailyLogForm siteId={site.id} onSaved={async () => { setShowLogForm(false); await refreshLogs() }} />
                </div>
              )}
            </div>
          )}

          {logs.length === 0 && (
            <p className="text-sm text-center py-6 px-5" style={{ color: 'var(--text-muted)' }}>No daily logs yet</p>
          )}

          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {logs.map(log => {
              const isOpen = expandedLog === log.id
              const isHighlighted = highlightDate && log.log_date === highlightDate
              const personnel: PersonnelEntry[] = log.personnel ?? []
              const issues: IssueEntry[] = log.issues ?? []
              const openCount = issues.filter(i => i.status === 'Open').length
              return (
                <div key={log.id} ref={isHighlighted ? highlightRef : undefined}
                  className="border-t" style={{ borderColor: 'var(--border)', background: isHighlighted ? 'rgba(251,146,60,0.08)' : undefined }}>
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
                      {isOpen
                        ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} />
                        : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-4 space-y-3">
                      {log.summary && (
                        <p className="text-xs leading-relaxed rounded-lg p-3"
                          style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                          {log.summary}
                        </p>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
      </Section>
    </div>
  )
}

function Kpi({ label, value, sub, color, highlight, href, hint, icon, onClick }: {
  label: string; value: string; sub: string; color: string
  highlight?: boolean; href?: string; hint?: string; icon?: React.ReactNode; onClick?: () => void
}) {
  const inner = (
    <div className="rounded-xl border p-4 transition-all h-full" title={hint}
      style={{
        background: 'var(--bg-surface)',
        borderColor: highlight ? color + '66' : 'var(--border)',
        cursor: href || onClick ? 'pointer' : 'default',
      }}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
        {icon && <span style={{ color }}>{icon}</span>}
      </div>
      <p className="text-3xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>
    </div>
  )
  if (href) return <Link href={href} className="block hover:opacity-90 transition-opacity">{inner}</Link>
  if (onClick) return <button className="block w-full text-left hover:opacity-90 transition-opacity" onClick={onClick}>{inner}</button>
  return inner
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
