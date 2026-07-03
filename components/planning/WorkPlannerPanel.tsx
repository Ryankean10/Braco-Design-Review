'use client'

import { useState } from 'react'
import {
  Zap, Users, Clock, PoundSterling, AlertTriangle, Calendar,
  ChevronLeft, Loader2, CheckCircle2, RefreshCw, FileText,
  TrendingUp, Package, ChevronDown, ChevronUp, Info,
} from 'lucide-react'
import Link from 'next/link'

// ── Types ────────────────────────────────────────────────────────────────────

interface Project {
  id: string
  name: string
  capacity_mw: number | null
  location: string | null
  stage: string | null
  client: string | null
}

interface Doc { id: string; doc_no: string | null; title: string | null; type: string | null; rev: string | null; stage: string | null }

interface DisciplineRow { discipline: string; hours: number; percentage: number; cost_gbp: number }
interface WeeklyPoint { week: number; crew: number; phase: string }
interface Phase { name: string; duration_weeks: number; start_offset_weeks: number; crew: number; manhours: number; description: string }
interface CostRow { package: string; low_gbp: number; mid_gbp: number; high_gbp: number }
interface LongLeadItem { item: string; lead_weeks_min: number; lead_weeks_max: number; risk_level: string; order_by_week: number; notes: string }
interface Risk { risk: string; impact: string; mitigation: string }

interface Forecast {
  summary: string
  confidence: 'Low' | 'Medium' | 'High'
  confidence_note: string
  benchmark_projects: string[]
  programme: { total_duration_weeks: number; total_duration_days: number; recommended_start: string; phases: Phase[] }
  manpower: { peak_crew: number; recommended_crew: number; total_manhours: number; by_discipline: DisciplineRow[]; weekly_profile: WeeklyPoint[] }
  cost: { total_low_gbp: number; total_mid_gbp: number; total_high_gbp: number; currency: string; basis: string; by_work_package: CostRow[] }
  long_lead_items: LongLeadItem[]
  risks: Risk[]
  assumptions: string[]
  analysed_at: string
}

interface SavedForecast { id: string; forecast: Forecast; created_at: string; status: string }

// ── Colour helpers ───────────────────────────────────────────────────────────

const RISK_COLOR: Record<string, string> = {
  Critical: '#ef4444', High: '#f97316', Medium: '#f59e0b', Low: '#10b981',
}

const DISCIPLINE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4']

const PHASE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#f97316']

function fmt(n: number) { return `£${(n / 1000).toFixed(0)}k` }

// ── Sub-components ───────────────────────────────────────────────────────────

function ManpowerHistogram({ profile, phases }: { profile: WeeklyPoint[]; phases: Phase[] }) {
  if (!profile?.length) return null
  const maxCrew = Math.max(...profile.map(w => w.crew), 1)
  const H = 120

  // build phase colour map
  const phaseColorMap: Record<string, string> = {}
  phases.forEach((p, i) => { phaseColorMap[p.name] = PHASE_COLORS[i % PHASE_COLORS.length] })

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-3">
        {phases.map((p, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            <div className="w-2 h-2 rounded-sm" style={{ background: PHASE_COLORS[i % PHASE_COLORS.length] }}/>
            {p.name}
          </div>
        ))}
      </div>
      <div className="relative overflow-x-auto">
        <svg viewBox={`0 0 ${profile.length * 12 + 40} ${H + 30}`} className="w-full" style={{ minWidth: Math.min(profile.length * 12 + 40, 900) }}>
          {/* Y-axis labels */}
          {[0, Math.round(maxCrew / 2), maxCrew].map(v => {
            const y = H - (v / maxCrew) * H
            return (
              <g key={v}>
                <line x1={32} y1={y} x2={profile.length * 12 + 40} y2={y} stroke="var(--border)" strokeWidth={0.5} strokeDasharray="3,3"/>
                <text x={28} y={y + 4} textAnchor="end" fontSize={9} fill="var(--text-muted)">{v}</text>
              </g>
            )
          })}
          {/* Bars */}
          {profile.map((w, i) => {
            const barH = (w.crew / maxCrew) * H
            const color = phaseColorMap[w.phase] ?? '#3b82f6'
            return (
              <rect key={i} x={36 + i * 12} y={H - barH} width={10} height={barH}
                fill={color} fillOpacity={0.8} rx={1}/>
            )
          })}
          {/* X-axis week labels every 5 */}
          {profile.filter((_, i) => i % 5 === 0).map((w, i) => (
            <text key={i} x={36 + w.week * 12 - 6} y={H + 14} fontSize={9} fill="var(--text-muted)">W{w.week}</text>
          ))}
          {/* Axis labels */}
          <text x={12} y={H / 2} textAnchor="middle" fontSize={9} fill="var(--text-muted)"
            transform={`rotate(-90, 12, ${H / 2})`}>Crew</text>
        </svg>
      </div>
    </div>
  )
}

function DisciplineBreakdown({ disciplines }: { disciplines: DisciplineRow[] }) {
  const total = disciplines.reduce((s, d) => s + d.hours, 0) || 1
  return (
    <div className="space-y-2">
      {disciplines.map((d, i) => (
        <div key={i}>
          <div className="flex justify-between text-xs mb-1">
            <span style={{ color: 'var(--text-primary)' }}>{d.discipline}</span>
            <span style={{ color: 'var(--text-muted)' }}>{d.hours.toLocaleString()}h · {fmt(d.cost_gbp)}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${(d.hours / total) * 100}%`, background: DISCIPLINE_COLORS[i % DISCIPLINE_COLORS.length] }}/>
          </div>
        </div>
      ))}
    </div>
  )
}

function CostBreakdown({ packages, totals }: { packages: CostRow[]; totals: { low: number; mid: number; high: number } }) {
  const max = totals.high || 1
  return (
    <div>
      {/* Range bar */}
      <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--bg-elevated)' }}>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Total cost range (GBP)</p>
        <div className="flex items-end gap-3 mb-2">
          <div className="text-center flex-1">
            <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Low</div>
            <div className="text-lg font-bold" style={{ color: '#10b981' }}>{fmt(totals.low)}</div>
          </div>
          <div className="text-center flex-1">
            <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Mid</div>
            <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{fmt(totals.mid)}</div>
          </div>
          <div className="text-center flex-1">
            <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>High</div>
            <div className="text-lg font-bold" style={{ color: '#f59e0b' }}>{fmt(totals.high)}</div>
          </div>
        </div>
        {/* Range track */}
        <div className="relative h-2 rounded-full mt-2" style={{ background: 'var(--border)' }}>
          <div className="absolute h-full rounded-full" style={{
            left: `${(totals.low / max) * 100}%`,
            width: `${((totals.high - totals.low) / max) * 100}%`,
            background: 'linear-gradient(90deg, #10b981, #f59e0b)',
          }}/>
          <div className="absolute w-2 h-2 rounded-full -translate-x-1/2 -translate-y-0" style={{
            left: `${(totals.mid / max) * 100}%`,
            background: 'var(--text-primary)',
            top: 0,
          }}/>
        </div>
      </div>

      {/* Per-package bars */}
      <div className="space-y-3">
        {packages.map((pkg, i) => (
          <div key={i}>
            <div className="flex justify-between text-xs mb-1">
              <span style={{ color: 'var(--text-primary)' }}>{pkg.package}</span>
              <span style={{ color: 'var(--text-muted)' }}>{fmt(pkg.low_gbp)} – {fmt(pkg.high_gbp)}</span>
            </div>
            <div className="relative h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
              <div className="absolute h-full rounded-full" style={{
                left: `${(pkg.low_gbp / max) * 100}%`,
                width: `${((pkg.high_gbp - pkg.low_gbp) / max) * 100}%`,
                background: DISCIPLINE_COLORS[i % DISCIPLINE_COLORS.length] + '99',
              }}/>
              <div className="absolute w-1.5 h-1.5 rounded-full -translate-x-1/2" style={{
                left: `${(pkg.mid_gbp / max) * 100}%`,
                background: DISCIPLINE_COLORS[i % DISCIPLINE_COLORS.length],
                top: 0,
              }}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LongLeadSchedule({ items, totalWeeks }: { items: LongLeadItem[]; totalWeeks: number }) {
  const sorted = [...items].sort((a, b) => b.lead_weeks_max - a.lead_weeks_max)
  const max = totalWeeks || 52
  return (
    <div className="space-y-2">
      {sorted.map((item, i) => {
        const orderStart = Math.max(0, max - item.order_by_week)
        const orderEnd = Math.min(max, orderStart + (item.lead_weeks_max - item.lead_weeks_min))
        const barStart = (orderStart / max) * 100
        const barWidth = Math.max(2, ((item.lead_weeks_max) / max) * 100)
        const color = RISK_COLOR[item.risk_level] ?? '#6b7280'
        return (
          <div key={i}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-1.5 py-0.5 rounded font-semibold shrink-0"
                style={{ background: color + '20', color, fontSize: 10 }}>{item.risk_level}</span>
              <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.item}</span>
              <span className="text-xs shrink-0 ml-auto" style={{ color: 'var(--text-muted)' }}>
                {item.lead_weeks_min}–{item.lead_weeks_max}w
              </span>
            </div>
            <div className="relative h-3 rounded" style={{ background: 'var(--bg-elevated)' }}>
              {/* Order window */}
              <div className="absolute h-full rounded"
                style={{ left: `${barStart}%`, width: `${barWidth}%`, background: color + '30', border: `1px solid ${color}40` }}/>
              {/* Order-by marker */}
              <div className="absolute h-full w-0.5 rounded"
                style={{ left: `${(orderStart / max) * 100}%`, background: color }}
                title={`Order by week ${orderStart}`}/>
            </div>
            {item.notes && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', fontSize: 10 }}>{item.notes}</p>}
          </div>
        )
      })}
      {/* X axis */}
      <div className="flex justify-between text-xs pt-1" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
        <span>Now</span>
        <span>Week {Math.round(max / 4)}</span>
        <span>Week {Math.round(max / 2)}</span>
        <span>Week {Math.round(max * 3 / 4)}</span>
        <span>Energise (W{max})</span>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WorkPlannerPanel({
  project, documents, initialForecast, canEdit,
}: {
  project: Project
  documents: Doc[]
  initialForecast: SavedForecast | null
  canEdit: boolean
}) {
  const [saved, setSaved] = useState<SavedForecast | null>(initialForecast)
  const [selectedDocs, setSelectedDocs] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [activeTab, setActiveTab] = useState<'manpower' | 'cost' | 'longlead' | 'risks'>('manpower')
  const [showDocPicker, setShowDocPicker] = useState(false)

  const forecast: Forecast | null = saved?.forecast ?? null

  const STEPS = ['Reading documents', 'Querying benchmarks', 'Scaling to project', 'Building forecast']

  async function generate() {
    setLoading(true)
    setError(null)
    setStep(0)

    const timer = setInterval(() => setStep(s => Math.min(s + 1, STEPS.length - 1)), 5000)

    try {
      const res = await fetch(`/api/planning/projects/${project.id}/forecast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_ids: selectedDocs, notes }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSaved(data)
    } catch (e) {
      setError(String(e))
    } finally {
      clearInterval(timer)
      setLoading(false)
    }
  }

  const toggleDoc = (id: string) =>
    setSelectedDocs(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id])

  const inputClass = "w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500/40"
  const inputStyle = { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }

  const CONF_COLOR = { High: '#10b981', Medium: '#f59e0b', Low: '#ef4444' }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Link href={`/projects/${project.id}`} className="flex items-center gap-1 text-xs mb-2 hover:opacity-80"
              style={{ color: 'var(--text-muted)' }}>
              <ChevronLeft size={12}/> Back to project
            </Link>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Work Planner</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {project.name} · {project.capacity_mw ? `${project.capacity_mw}MW` : ''} · {project.stage ?? 'Design'}
            </p>
          </div>
          {saved && canEdit && (
            <button onClick={generate} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border disabled:opacity-50"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              <RefreshCw size={12}/> Regenerate
            </button>
          )}
        </div>

        {/* Generate panel — shown when no forecast or user clicks regenerate */}
        {(!forecast || loading) && (
          <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <TrendingUp size={14} className="text-blue-400"/> Generate AI Forecast
            </h2>

            {/* Document picker */}
            <div className="mb-4">
              <button onClick={() => setShowDocPicker(v => !v)}
                className="flex items-center gap-2 text-xs font-medium mb-2 w-full text-left"
                style={{ color: 'var(--text-muted)' }}>
                <FileText size={12}/>
                Project documents to include ({selectedDocs.length} of {documents.length} selected)
                {showDocPicker ? <ChevronUp size={12} className="ml-auto"/> : <ChevronDown size={12} className="ml-auto"/>}
              </button>
              {showDocPicker && documents.length > 0 && (
                <div className="rounded-lg border divide-y max-h-48 overflow-y-auto"
                  style={{ borderColor: 'var(--border)' }}>
                  {documents.map(doc => (
                    <label key={doc.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:opacity-80">
                      <input type="checkbox" checked={selectedDocs.includes(doc.id)} onChange={() => toggleDoc(doc.id)}
                        className="rounded"/>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                          {doc.doc_no ? `${doc.doc_no} — ` : ''}{doc.title ?? 'Untitled'}
                        </span>
                        {doc.type && <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>{doc.type}</span>}
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {showDocPicker && documents.length === 0 && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No documents in project library yet. Forecast will use benchmarks only.</p>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                Additional context (optional)
              </label>
              <textarea className={inputClass} style={inputStyle} rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="e.g. 7 MVS banks, similar layout to Braco, target energise March 2027, restricted access in winter..."/>
            </div>

            <div className="rounded-lg p-3 mb-4 flex items-start gap-2" style={{ background: 'var(--bg-elevated)' }}>
              <Info size={12} className="shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }}/>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                The AI forecast engine benchmarks against Dyce (50MW), Braco (50MW), and Kilwinning (27MW) using actuals from P6 programmes. Confidence is Low until more project-specific data is available.
              </p>
            </div>

            {/* Progress bar */}
            {loading && (
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  <span>{STEPS[step]}</span>
                  <span>{step + 1}/{STEPS.length}</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${((step + 1) / STEPS.length) * 100}%`, background: 'var(--accent)' }}/>
                </div>
                <div className="flex justify-between mt-2">
                  {STEPS.map((s, i) => (
                    <span key={i} className="text-xs" style={{ color: i <= step ? 'var(--accent)' : 'var(--text-muted)', fontSize: 10 }}>
                      {i < step ? '✓' : i === step ? '…' : '○'} {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

            {canEdit && (
              <button onClick={generate} disabled={loading}
                className="w-full py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: 'var(--accent)', color: 'white' }}>
                {loading ? <><Loader2 size={14} className="animate-spin"/>Forecasting…</> : <><TrendingUp size={14}/>Generate Forecast</>}
              </button>
            )}
          </div>
        )}

        {/* ── Forecast output ──────────────────────────────────────────── */}
        {forecast && !loading && (
          <>
            {/* KPI tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Duration', value: `${forecast.programme.total_duration_weeks}w`, sub: `${forecast.programme.total_duration_days} days`, icon: <Calendar size={13}/>, color: '#3b82f6' },
                { label: 'Peak crew', value: forecast.manpower.peak_crew, sub: `${forecast.manpower.recommended_crew} recommended`, icon: <Users size={13}/>, color: '#8b5cf6' },
                { label: 'Manhours', value: forecast.manpower.total_manhours.toLocaleString(), sub: 'total construction', icon: <Clock size={13}/>, color: '#10b981' },
                { label: 'Est. cost', value: fmt(forecast.cost.total_mid_gbp), sub: `${fmt(forecast.cost.total_low_gbp)} – ${fmt(forecast.cost.total_high_gbp)}`, icon: <PoundSterling size={13}/>, color: '#f59e0b' },
              ].map(k => (
                <div key={k.label} className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
                  <div className="flex items-center gap-1.5 mb-2" style={{ color: k.color }}>
                    {k.icon}<span className="text-xs font-medium">{k.label}</span>
                  </div>
                  <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{k.value}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Summary + confidence */}
            <div className="rounded-xl border p-4 flex gap-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
              <div className="flex-1">
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{forecast.summary}</p>
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                  Benchmarked against: {forecast.benchmark_projects?.join(', ')}
                </p>
              </div>
              <div className="shrink-0 text-center">
                <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Confidence</div>
                <div className="text-lg font-bold" style={{ color: CONF_COLOR[forecast.confidence] ?? '#6b7280' }}>
                  {forecast.confidence}
                </div>
                <div className="text-xs max-w-[120px]" style={{ color: 'var(--text-muted)', fontSize: 10 }}>{forecast.confidence_note}</div>
              </div>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 rounded-lg p-1" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}>
              {([
                { key: 'manpower', label: 'Manpower', icon: <Users size={12}/> },
                { key: 'cost', label: 'Cost', icon: <PoundSterling size={12}/> },
                { key: 'longlead', label: 'Long Lead', icon: <Package size={12}/> },
                { key: 'risks', label: 'Risks', icon: <AlertTriangle size={12}/> },
              ] as const).map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-all"
                  style={{
                    background: activeTab === t.key ? 'var(--accent)' : 'transparent',
                    color: activeTab === t.key ? 'white' : 'var(--text-muted)',
                  }}>
                  {t.icon}{t.label}
                </button>
              ))}
            </div>

            {/* ── Manpower tab ─────────────────────────────────────────── */}
            {activeTab === 'manpower' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
                  <h3 className="text-xs font-semibold mb-4" style={{ color: 'var(--text-muted)' }}>CREW PROFILE — WEEKLY</h3>
                  <ManpowerHistogram profile={forecast.manpower.weekly_profile} phases={forecast.programme.phases}/>
                </div>
                <div className="space-y-4">
                  <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
                    <h3 className="text-xs font-semibold mb-4" style={{ color: 'var(--text-muted)' }}>MANHOURS BY DISCIPLINE</h3>
                    <DisciplineBreakdown disciplines={forecast.manpower.by_discipline}/>
                  </div>
                  <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
                    <h3 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>PROGRAMME PHASES</h3>
                    <div className="space-y-3">
                      {forecast.programme.phases.map((ph, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 text-white"
                            style={{ background: PHASE_COLORS[i % PHASE_COLORS.length], fontSize: 9 }}>{i + 1}</div>
                          <div className="flex-1">
                            <div className="flex justify-between">
                              <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{ph.name}</span>
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{ph.duration_weeks}w · {ph.crew} crew · {ph.manhours.toLocaleString()}h</span>
                            </div>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{ph.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Cost tab ─────────────────────────────────────────────── */}
            {activeTab === 'cost' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
                  <h3 className="text-xs font-semibold mb-4" style={{ color: 'var(--text-muted)' }}>COST ESTIMATE BY WORK PACKAGE</h3>
                  <CostBreakdown
                    packages={forecast.cost.by_work_package}
                    totals={{ low: forecast.cost.total_low_gbp, mid: forecast.cost.total_mid_gbp, high: forecast.cost.total_high_gbp }}
                  />
                </div>
                <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
                  <h3 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>COST BASIS</h3>
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{forecast.cost.basis}</p>
                  <div className="mt-4 space-y-2">
                    {forecast.cost.by_work_package.map((pkg, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span style={{ color: 'var(--text-muted)' }}>{pkg.package}</span>
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{fmt(pkg.mid_gbp)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-semibold pt-2 border-t" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                      <span>Total (mid)</span>
                      <span>{fmt(forecast.cost.total_mid_gbp)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Long lead tab ─────────────────────────────────────────── */}
            {activeTab === 'longlead' && (
              <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>LONG LEAD PROCUREMENT SCHEDULE</h3>
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#ef444420', color: '#ef4444', fontSize: 10 }}>
                    {forecast.long_lead_items.filter(i => i.risk_level === 'Critical').length} Critical
                  </span>
                </div>
                <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                  Timeline shows order window relative to planned energisation date. Order by markers indicate latest safe order date.
                </p>
                <LongLeadSchedule
                  items={forecast.long_lead_items}
                  totalWeeks={forecast.programme.total_duration_weeks}
                />
              </div>
            )}

            {/* ── Risks tab ─────────────────────────────────────────────── */}
            {activeTab === 'risks' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
                  <h3 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>KEY RISKS</h3>
                  <div className="space-y-3">
                    {forecast.risks.map((r, i) => (
                      <div key={i} className="rounded-lg p-3" style={{ background: 'var(--bg-elevated)' }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-1.5 py-0.5 rounded font-semibold"
                            style={{ background: (RISK_COLOR[r.impact] ?? '#6b7280') + '20', color: RISK_COLOR[r.impact] ?? '#6b7280', fontSize: 10 }}>
                            {r.impact}
                          </span>
                          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{r.risk}</span>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>↳ {r.mitigation}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
                  <h3 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>ASSUMPTIONS</h3>
                  <ul className="space-y-2">
                    {forecast.assumptions.map((a, i) => (
                      <li key={i} className="flex gap-2 text-xs" style={{ color: 'var(--text-primary)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{i + 1}.</span>{a}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Footer */}
            <p className="text-xs text-center pb-4" style={{ color: 'var(--text-muted)' }}>
              <CheckCircle2 size={10} className="inline mr-1"/>
              Forecast generated {new Date(forecast.analysed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {' · '}AI-generated estimate — verify against project specifics before committing to procurement or programme.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
