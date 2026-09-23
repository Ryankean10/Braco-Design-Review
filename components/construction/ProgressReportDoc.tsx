'use client'

import { useMemo } from 'react'

interface CableItem {
  cable_ref: string; package_name: string; mvs: string | null
  overall_status: string; completion_pct: number; scope?: string
}
interface DailyLog { log_date: string; total_manhours: number | null }
interface CivilsActivity {
  activity_group: string; category: string; status: string; progress_pct: number
}

interface Props {
  siteName: string; client: string; location: string; voltageKv: number | null
  cables: CableItem[]; allLogs: DailyLog[]; civilsActivities: CivilsActivity[]
}

const PKG_COLOR: Record<string, string> = {
  'AC Battery Cable':    '#3b82f6',
  '5C 70mm² Skid Cable': '#8b5cf6',
  'LV Power':            '#f59e0b',
  'Fibre Cable':         '#10b981',
  'Comms / Multicore':   '#ec4899',
  '33kV HV Cable':       '#ef4444',
}

function Bar({ pct, color, height = 6 }: { pct: number; color: string; height?: number }) {
  return (
    <div style={{ height, borderRadius: 3, background: 'var(--border)', overflow: 'hidden', width: '100%' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width .4s' }} />
    </div>
  )
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="avoid-break" style={{
      border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px',
      background: 'var(--bg-elevated)', textAlign: 'center',
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>}
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
      color: 'var(--text-muted)', borderBottom: '1px solid var(--border)',
      paddingBottom: 4, marginBottom: 8,
    }}>{title}</div>
  )
}

export default function ProgressReportDoc({ siteName, client, location, voltageKv, cables, allLogs, civilsActivities }: Props) {
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

  // ── Cable stats ────────────────────────────────────────────────────────────
  const ipe          = cables.filter(c => !c.scope || c.scope === 'IPE')
  const cableTotal   = ipe.length
  const cableComp    = ipe.filter(c => c.overall_status === 'Complete').length
  const cableWip     = ipe.filter(c => c.overall_status === 'In Progress').length
  const cableBlocked = ipe.filter(c => c.overall_status === 'Blocked').length
  const cablePct     = cableTotal ? Math.round((ipe.reduce((s, c) => s + (c.completion_pct ?? 0), 0) / cableTotal) * 100) : 0

  // ── Civils stats ───────────────────────────────────────────────────────────
  const civTotal  = civilsActivities.length
  const civComp   = civilsActivities.filter(a => a.status === 'Complete').length
  const civWip    = civilsActivities.filter(a => a.status === 'In Progress').length
  const civPct    = civTotal > 0 ? Math.round(civilsActivities.reduce((s, a) => s + a.progress_pct, 0) / civTotal) : null
  const below     = civilsActivities.filter(a => a.category === 'Below Ground')
  const above     = civilsActivities.filter(a => a.category === 'Above Ground')
  const belowPct  = below.length > 0 ? Math.round(below.reduce((s, a) => s + a.progress_pct, 0) / below.length) : 0
  const abovePct  = above.length > 0 ? Math.round(above.reduce((s, a) => s + a.progress_pct, 0) / above.length) : 0

  // Blended overall
  const overallPct = civPct !== null ? Math.round((cablePct + civPct) / 2) : cablePct

  // ── Manhours ───────────────────────────────────────────────────────────────
  const sortedLogs  = useMemo(() => [...allLogs].sort((a, b) => a.log_date.localeCompare(b.log_date)), [allLogs])
  const totalMh     = sortedLogs.reduce((s, l) => s + (l.total_manhours ?? 0), 0)
  const daysOnSite  = sortedLogs.length
  const firstDay    = sortedLogs[0]
    ? new Date(sortedLogs[0].log_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'

  // ── Packages ───────────────────────────────────────────────────────────────
  const pkgs = useMemo(() => {
    const g: Record<string, { total: number; complete: number }> = {}
    for (const c of ipe) {
      if (!g[c.package_name]) g[c.package_name] = { total: 0, complete: 0 }
      g[c.package_name].total++
      if (c.overall_status === 'Complete') g[c.package_name].complete++
    }
    return Object.entries(g).map(([name, v]) => ({
      name, ...v, pct: v.total ? Math.round((v.complete / v.total) * 100) : 0,
    })).sort((a, b) => b.pct - a.pct)
  }, [ipe])

  // ── MVS ────────────────────────────────────────────────────────────────────
  const mvsData = useMemo(() => {
    const g: Record<string, { complete: number; wip: number; total: number }> = {}
    for (const c of ipe.filter(c => c.mvs)) {
      const k = c.mvs!
      if (!g[k]) g[k] = { complete: 0, wip: 0, total: 0 }
      g[k].total++
      if (c.overall_status === 'Complete') g[k].complete++
      else if (c.overall_status === 'In Progress') g[k].wip++
    }
    return Object.entries(g)
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([mvs, v]) => ({ mvs, ...v, pct: Math.round((v.complete / v.total) * 100) }))
  }, [ipe])

  // ── Manhours chart (last 28 site days) ────────────────────────────────────
  const chartLogs = sortedLogs.slice(-28)
  const maxMh     = Math.max(...chartLogs.map(l => l.total_manhours ?? 0), 1)
  const cW = 580, cH = 72

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: 'var(--text-primary)', background: '#fff' }}>

      {/* ── Document header ─────────────────────────────────────────────────── */}
      <div className="avoid-break" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        borderBottom: '2px solid #4f46e5', paddingBottom: 10, marginBottom: 16,
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>
            Construction Progress Report
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#4f46e5', marginTop: 2 }}>{siteName}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
            {client}{location ? ` · ${location}` : ''}{voltageKv ? ` · ${voltageKv}kV` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Date issued</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#111827' }}>{today}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>Confidential — not for distribution</div>
        </div>
      </div>

      {/* ── Overall blended progress ─────────────────────────────────────────── */}
      <div className="avoid-break" style={{ marginBottom: 16 }}>
        <SectionHeader title="Overall project progress" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          <div style={{ fontSize: 42, fontWeight: 800, color: overallPct >= 80 ? '#16a34a' : '#4f46e5', lineHeight: 1 }}>
            {overallPct}%
          </div>
          <div style={{ flex: 1 }}>
            <Bar pct={overallPct} color={overallPct >= 80 ? '#16a34a' : '#4f46e5'} height={10} />
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>
              Blended overall · {cablePct}% electrical / cable{civPct !== null ? ` · ${civPct}% civils` : ''}
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
          <Kpi label="Cable complete"    value={`${cablePct}%`}   sub={`${cableComp}/${cableTotal}`}   color="#3b82f6" />
          <Kpi label="Cable WIP"         value={String(cableWip)}  sub="in progress"                   color="#f59e0b" />
          <Kpi label="Civils progress"   value={civPct !== null ? `${civPct}%` : '—'} sub={civTotal > 0 ? `${civComp}/${civTotal} complete` : 'no data'} color="#fb923c" />
          <Kpi label="Manhours to date"  value={totalMh.toLocaleString()} sub={`${daysOnSite} site days`} color="#8b5cf6" />
          <Kpi label="On site since"     value={firstDay}          sub="start date"                    color="#10b981" />
        </div>
      </div>

      {/* ── Civils | Electrical side by side ────────────────────────────────── */}
      <div className="avoid-break" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>

        {/* Civils */}
        <div style={{ border: '1px solid #fed7aa', borderRadius: 6, padding: 10, background: '#fff7ed' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e' }}>▪ Civils Works</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: civPct === 100 ? '#16a34a' : '#c2410c' }}>
              {civPct !== null ? `${civPct}%` : '—'}
            </div>
          </div>

          {civPct !== null && <Bar pct={civPct} color={civPct === 100 ? '#16a34a' : '#ea580c'} height={5} />}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, margin: '8px 0' }}>
            {[
              { label: 'Below Ground', pct: belowPct, acts: below },
              { label: 'Above Ground', pct: abovePct, acts: above },
            ].map(({ label, pct, acts }) => (
              <div key={label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 2 }}>
                  <span style={{ color: '#92400e' }}>{label}</span>
                  <span style={{ color: '#6b7280' }}>{acts.filter(a => a.status === 'Complete').length}/{acts.length} · {pct}%</span>
                </div>
                <Bar pct={pct} color={pct === 100 ? '#16a34a' : '#ea580c'} height={4} />
              </div>
            ))}
          </div>

          {/* Activity rows */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
            <tbody>
              {civilsActivities.map(a => (
                <tr key={a.activity_group} style={{ borderTop: '1px solid #fed7aa' }}>
                  <td style={{ padding: '3px 0', fontSize: 9, color: '#111827' }}>
                    <span style={{
                      display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                      background: a.status === 'Complete' ? '#16a34a' : a.status === 'In Progress' ? '#ea580c' : '#d1d5db',
                      marginRight: 5, verticalAlign: 'middle',
                    }} />
                    {a.activity_group}
                  </td>
                  <td style={{ padding: '3px 0', fontSize: 9, textAlign: 'right', color: '#6b7280', width: 80 }}>
                    {a.status === 'Complete'
                      ? <span style={{ color: '#16a34a', fontWeight: 600 }}>Complete</span>
                      : <>{a.progress_pct}%</>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: 8, marginTop: 8, fontSize: 9, color: '#6b7280' }}>
            <span>✓ {civComp} complete</span>
            <span>◷ {civWip} WIP</span>
            <span>○ {civTotal - civComp - civWip} not started</span>
          </div>
        </div>

        {/* Electrical */}
        <div style={{ border: '1px solid #bfdbfe', borderRadius: 6, padding: 10, background: '#eff6ff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#1e3a8a' }}>▪ Electrical / Cable</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: cablePct === 100 ? '#16a34a' : '#1d4ed8' }}>
              {cablePct}%
            </div>
          </div>

          <Bar pct={cablePct} color={cablePct === 100 ? '#16a34a' : '#2563eb'} height={5} />

          {/* Package table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', margin: '8px 0' }}>
            <thead>
              <tr>
                <th style={{ fontSize: 8, fontWeight: 600, color: '#6b7280', textAlign: 'left', paddingBottom: 3, borderBottom: '1px solid #bfdbfe' }}>Package</th>
                <th style={{ fontSize: 8, fontWeight: 600, color: '#6b7280', textAlign: 'right', paddingBottom: 3, borderBottom: '1px solid #bfdbfe', width: 60 }}>Done</th>
                <th style={{ fontSize: 8, fontWeight: 600, color: '#6b7280', textAlign: 'right', paddingBottom: 3, borderBottom: '1px solid #bfdbfe', width: 36 }}>%</th>
                <th style={{ fontSize: 8, fontWeight: 600, color: '#6b7280', paddingBottom: 3, borderBottom: '1px solid #bfdbfe', width: 70 }}></th>
              </tr>
            </thead>
            <tbody>
              {pkgs.map(p => (
                <tr key={p.name} style={{ borderTop: '1px solid #dbeafe' }}>
                  <td style={{ padding: '3px 0', fontSize: 9, color: '#111827' }}>{p.name}</td>
                  <td style={{ padding: '3px 0', fontSize: 9, color: '#6b7280', textAlign: 'right' }}>{p.complete}/{p.total}</td>
                  <td style={{ padding: '3px 0', fontSize: 9, fontWeight: 600, textAlign: 'right', color: p.pct === 100 ? '#16a34a' : '#1d4ed8' }}>{p.pct}%</td>
                  <td style={{ padding: '3px 4px' }}>
                    <Bar pct={p.pct} color={PKG_COLOR[p.name] ?? '#6b7280'} height={4} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: 8, fontSize: 9, color: '#6b7280' }}>
            <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ {cableComp} complete</span>
            <span>◷ {cableWip} WIP</span>
            {cableBlocked > 0 && <span style={{ color: '#dc2626' }}>✕ {cableBlocked} blocked</span>}
          </div>
        </div>
      </div>

      {/* ── MVS status grid ──────────────────────────────────────────────────── */}
      {mvsData.length > 0 && (
        <div className="avoid-break" style={{ marginBottom: 16 }}>
          <SectionHeader title="MVS completion — AC battery cables (IPE scope)" />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)' }}>
                {['MVS', 'Complete', 'WIP', 'Total', 'Progress', '%'].map(h => (
                  <th key={h} style={{ fontSize: 8, fontWeight: 600, color: 'var(--text-muted)', padding: '4px 6px', textAlign: h === 'Progress' ? 'left' : 'center', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mvsData.map((m, i) => (
                <tr key={m.mvs} style={{ background: i % 2 === 0 ? '#f9fafb' : '#fff' }}>
                  <td style={{ padding: '4px 6px', fontSize: 10, fontWeight: 700, color: '#111827' }}>{m.mvs}</td>
                  <td style={{ padding: '4px 6px', fontSize: 9, textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>{m.complete}</td>
                  <td style={{ padding: '4px 6px', fontSize: 9, textAlign: 'center', color: '#d97706' }}>{m.wip}</td>
                  <td style={{ padding: '4px 6px', fontSize: 9, textAlign: 'center', color: '#6b7280' }}>{m.total}</td>
                  <td style={{ padding: '4px 6px', width: 120 }}>
                    <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: '#e5e7eb' }}>
                      <div style={{ width: `${(m.complete / m.total) * 100}%`, background: '#16a34a' }} />
                      <div style={{ width: `${(m.wip / m.total) * 100}%`, background: '#f59e0b' }} />
                    </div>
                  </td>
                  <td style={{ padding: '4px 6px', fontSize: 10, fontWeight: 700, textAlign: 'center', color: m.pct === 100 ? '#16a34a' : '#1d4ed8' }}>{m.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 8, color: '#6b7280' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#16a34a', display: 'inline-block' }} /> Complete</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#f59e0b', display: 'inline-block' }} /> In Progress</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#e5e7eb', display: 'inline-block' }} /> Not Started</span>
          </div>
        </div>
      )}

      {/* ── Manhours trend chart ─────────────────────────────────────────────── */}
      {chartLogs.length > 2 && (
        <div className="avoid-break" style={{ marginBottom: 16 }}>
          <SectionHeader title={`Daily manhours — last ${chartLogs.length} site days`} />
          <svg viewBox={`0 0 ${cW} ${cH + 20}`} style={{ width: '100%', maxHeight: 100 }}>
            {[0.5, 1].map(f => (
              <g key={f}>
                <line x1="28" y1={cH - f * cH} x2={cW} y2={cH - f * cH} stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="3 2" />
                <text x="24" y={cH - f * cH + 3} fontSize="7" textAnchor="end" fill="#9ca3af">{Math.round(f * maxMh)}</text>
              </g>
            ))}
            {chartLogs.map((l, i) => {
              const bw   = Math.max(6, Math.floor((cW - 32) / chartLogs.length) - 1)
              const x    = 30 + i * (bw + 1)
              const h    = ((l.total_manhours ?? 0) / maxMh) * cH
              const last7 = i >= chartLogs.length - 7
              return (
                <g key={l.log_date}>
                  <rect x={x} y={cH - h} width={bw} height={h} rx="1"
                    fill={last7 ? '#3b82f6' : '#93c5fd'} />
                  {(i === 0 || i === chartLogs.length - 1 || i % Math.max(1, Math.floor(chartLogs.length / 6)) === 0) && (
                    <text x={x + bw / 2} y={cH + 12} fontSize="6" textAnchor="middle" fill="#9ca3af">
                      {new Date(l.log_date + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </text>
                  )}
                </g>
              )
            })}
            <line x1="28" y1={cH} x2={cW} y2={cH} stroke="#d1d5db" strokeWidth="1" />
          </svg>
          <div style={{ fontSize: 8, color: '#9ca3af', marginTop: 2 }}>
            Darker bars = last 7 days · Total to date: {totalMh.toLocaleString()} manhours across {daysOnSite} site days
          </div>
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <div style={{
        borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 8,
        display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#9ca3af',
      }}>
        <span>MRRK · Construction Progress Report · {siteName}</span>
        <span>Generated {today} · Confidential</span>
      </div>

    </div>
  )
}
