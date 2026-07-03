'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Upload, FileText, ChevronDown, ChevronUp, AlertTriangle,
  Calendar, Clock, TrendingUp, TrendingDown, Minus,
  AlertCircle, CheckCircle2, Loader2, X
} from 'lucide-react'

interface UpcomingActivity {
  activity: string
  due: string
  days_away: number
  impact: 'Critical' | 'Major' | 'Minor'
  note: string
}

interface Analysis {
  summary: string
  overall_status: 'On Programme' | 'Slipping' | 'Critical' | 'Ahead'
  completion_date_current: string | null
  completion_date_previous: string | null
  slippage_days: number
  status_today: string[]
  critical_path: string[]
  upcoming_activities: UpcomingActivity[]
  key_changes: { activity: string; change: string; impact: 'Critical' | 'Major' | 'Minor' }[]
  risks: string[]
  recommendations: string[]
  analysed_at: string
}

interface Programme {
  id: string
  revision: string
  programme_date: string
  file_path: string
  file_name: string
  notes: string | null
  uploaded_at: string
  analysis: Analysis | null
}

interface Props {
  siteId: string
  initialProgrammes: Programme[]
  signedUrls: Record<string, string>
  canEdit: boolean
}

const STATUS_CFG = {
  'On Programme': { color: '#4ade80', icon: <CheckCircle2 size={13}/> },
  'Ahead':        { color: '#34d399', icon: <TrendingUp size={13}/> },
  'Slipping':     { color: '#fb923c', icon: <TrendingDown size={13}/> },
  'Critical':     { color: '#f87171', icon: <AlertCircle size={13}/> },
}

const IMPACT_COLOR = { Critical: '#f87171', Major: '#fb923c', Minor: '#60a5fa' }

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

export default function ProgrammePanel({ siteId, initialProgrammes, signedUrls: initialUrls, canEdit }: Props) {
  const [programmes, setProgrammes] = useState<Programme[]>(initialProgrammes)
  const [urls, setUrls] = useState<Record<string, string>>(initialUrls)
  const [collapsed, setCollapsed] = useState(false)
  const [viewing, setViewing] = useState<string | null>(initialProgrammes[0]?.id ?? null)
  const [showHistory, setShowHistory] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [analysing, setAnalysing] = useState(false)
  const [analysisFailed, setAnalysisFailed] = useState(false)
  const [analysisStep, setAnalysisStep] = useState(0) // 0-3
  const [revision, setRevision] = useState('')
  const [programmeDate, setProgrammeDate] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const latest = programmes[0]
  const staleDays = latest ? daysSince(latest.uploaded_at) : null
  const isStale = staleDays !== null && staleDays > 28
  const viewingProg = programmes.find(p => p.id === viewing)
  const viewingUrl = viewing ? urls[viewing] : null

  const runAnalysis = useCallback(async (progId: string) => {
    setAnalysisFailed(false)
    setAnalysing(true)
    setAnalysisStep(0)

    // Trigger the analysis
    const triggerRes = await fetch(`/api/construction/sites/${siteId}/programme/${progId}/analyse`, { method: 'POST' })
    if (!triggerRes.ok) {
      setAnalysing(false)
      setAnalysisFailed(true)
      return
    }
    const result = await triggerRes.json()
    if (result.error) {
      setAnalysing(false)
      setAnalysisFailed(true)
      return
    }
    // Analysis returned directly — update state
    setProgrammes(prev => prev.map(p => p.id === progId ? { ...p, analysis: result } : p))
    setAnalysing(false)
    setAnalysisStep(4)
  }, [siteId])

  // Poll for analysis if latest programme doesn't have one yet
  const pollAnalysis = useCallback(async (progId: string) => {
    setAnalysing(true)
    setAnalysisFailed(false)
    // Step through stages on a timer while waiting
    const stepInterval = setInterval(() => {
      setAnalysisStep(s => Math.min(s + 1, ANALYSIS_STEPS.length - 1))
    }, 8000)

    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 4000))
      const res = await fetch(`/api/construction/sites/${siteId}/programme`)
      if (res.ok) {
        const data: Programme[] = await res.json()
        const prog = data.find(p => p.id === progId)
        if (prog?.analysis) {
          clearInterval(stepInterval)
          setProgrammes(data)
          setAnalysing(false)
          setAnalysisStep(4)
          return
        }
      }
    }
    clearInterval(stepInterval)
    setAnalysing(false)
    setAnalysisFailed(true)
  }, [siteId]) // eslint-disable-line react-hooks/exhaustive-deps

  const ANALYSIS_STEPS = ['Extracting programme data', 'Comparing revisions', 'Identifying changes', 'Generating PVA report']

  // If latest programme has no analysis, trigger it
  useEffect(() => {
    if (latest && !latest.analysis) {
      runAnalysis(latest.id)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file || !revision || !programmeDate) {
      setError('Please fill in all required fields and choose a file.')
      return
    }
    setUploading(true)
    setError(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('revision', revision)
    fd.append('programme_date', programmeDate)
    if (notes) fd.append('notes', notes)

    const res = await fetch(`/api/construction/sites/${siteId}/programme`, { method: 'POST', body: fd })
    if (!res.ok) {
      const { error: e } = await res.json()
      setError(e ?? 'Upload failed')
      setUploading(false)
      return
    }
    const newProg: Programme = await res.json()

    const urlRes = await fetch(`/api/construction/sites/${siteId}/programme/${newProg.id}/url`)
    let signedUrl = ''
    if (urlRes.ok) { const { url } = await urlRes.json(); signedUrl = url }

    // Analysis runs server-side during upload — use returned analysis if present
    setProgrammes(prev => [newProg, ...prev])
    setUrls(prev => ({ ...prev, [newProg.id]: signedUrl }))
    setViewing(newProg.id)
    setShowUpload(false)
    setRevision('')
    setProgrammeDate('')
    setNotes('')
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''

    // If analysis didn't come back with the upload, trigger it now
    if (!newProg.analysis) {
      runAnalysis(newProg.id)
    } else {
      setAnalysisStep(4)
    }
  }

  const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const analysis = viewingProg?.analysis ?? null
  const statusCfg = analysis ? STATUS_CFG[analysis.overall_status] : null

  return (
    <div id="programme" className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>

      {/* Header */}
      <div className="px-5 py-3 flex items-center justify-between gap-3"
        style={{ background: 'var(--bg-surface)', borderBottom: collapsed ? 'none' : '1px solid var(--border)' }}>
        <button onClick={() => setCollapsed(c => !c)} className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-80">
          {collapsed ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }}/> : <ChevronUp size={14} style={{ color: 'var(--text-muted)' }}/>}
          <Calendar size={15} style={{ color: 'var(--accent)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>P6 Construction Programme</p>
          {latest && (
            <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{
              background: isStale ? 'rgba(251,146,60,0.15)' : 'rgba(74,222,128,0.12)',
              color: isStale ? '#fb923c' : '#4ade80'
            }}>
              {latest.revision} · {fmtDate(latest.programme_date)}
            </span>
          )}
          {statusCfg && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full shrink-0"
              style={{ background: statusCfg.color + '20', color: statusCfg.color }}>
              {statusCfg.icon}
              {analysis!.overall_status}
              {analysis!.slippage_days !== 0 && (
                <span className="ml-0.5">
                  ({analysis!.slippage_days > 0 ? '+' : ''}{analysis!.slippage_days}d)
                </span>
              )}
            </span>
          )}
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {programmes.length > 1 && !collapsed && (
            <button onClick={() => setShowHistory(h => !h)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded"
              style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)' }}>
              {showHistory ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
              {programmes.length - 1} previous
            </button>
          )}
          {canEdit && (
            <button onClick={() => { setShowUpload(u => !u); setCollapsed(false) }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold"
              style={{ background: 'var(--accent)', color: '#000' }}>
              <Upload size={12}/> Upload
            </button>
          )}
        </div>
      </div>

      {collapsed ? null : (
        <>
          {/* Stale warning */}
          {isStale && (
            <div className="flex items-center gap-2 px-5 py-2.5 border-b text-xs"
              style={{ background: 'rgba(251,146,60,0.08)', borderColor: 'rgba(251,146,60,0.3)', color: '#fb923c' }}>
              <AlertTriangle size={13}/>
              Programme last updated {staleDays} days ago — upload an updated revision to keep analytics accurate.
            </div>
          )}

          {/* No programme yet */}
          {programmes.length === 0 && !showUpload && (
            <div className="px-5 py-10 text-center">
              <FileText size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No programme uploaded yet</p>
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Upload the P6 export PDF to track planned vs actual progress</p>
              {canEdit && (
                <button onClick={() => setShowUpload(true)}
                  className="text-xs px-4 py-2 rounded-lg font-semibold"
                  style={{ background: 'var(--accent)', color: '#000' }}>
                  <Upload size={12} className="inline mr-1.5"/> Upload Programme
                </button>
              )}
            </div>
          )}

          {/* Upload form */}
          {showUpload && (
            <div className="px-5 py-4 border-b space-y-3" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Upload Programme</p>
                <button onClick={() => { setShowUpload(false); setError(null) }} style={{ color: 'var(--text-muted)' }}><X size={14}/></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Revision *</label>
                  <input value={revision} onChange={e => setRevision(e.target.value)} placeholder="e.g. REV4.2"
                    className="w-full text-sm px-3 py-2 rounded-lg border"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}/>
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Programme date *</label>
                  <input type="date" value={programmeDate} onChange={e => setProgrammeDate(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg border"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}/>
                </div>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>PDF file *</label>
                <input ref={fileRef} type="file" accept=".pdf"
                  className="w-full text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:text-xs file:font-semibold cursor-pointer"
                  style={{ color: 'var(--text-muted)' }}/>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Notes</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Issued for construction, includes revised HV works"
                  className="w-full text-sm px-3 py-2 rounded-lg border"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}/>
              </div>
              {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}
              <div className="flex gap-2">
                <button onClick={handleUpload} disabled={uploading}
                  className="text-xs px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: '#000' }}>
                  {uploading ? 'Uploading…' : 'Upload'}
                </button>
                <button onClick={() => { setShowUpload(false); setError(null) }}
                  className="text-xs px-4 py-2 rounded-lg"
                  style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Revision history */}
          {showHistory && programmes.length > 1 && (
            <div className="border-b" style={{ borderColor: 'var(--border)' }}>
              {programmes.slice(1).map(p => (
                <button key={p.id} onClick={() => { setViewing(p.id); setShowHistory(false) }}
                  className="w-full flex items-center gap-3 px-5 py-2.5 text-left hover:opacity-80 border-b last:border-0"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                  <FileText size={13} style={{ color: 'var(--text-muted)' }}/>
                  <span className="text-xs font-medium flex-1" style={{ color: 'var(--text-primary)' }}>{p.revision}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(p.programme_date)}</span>
                  <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                    <Clock size={10}/> {fmtDate(p.uploaded_at)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* AI Analysis */}
          {(analysis || analysing || analysisFailed) && (
            <div className="border-b" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => !analysing && setShowAnalysis(a => !a)}
                className="w-full flex items-center gap-2 px-5 py-2.5 text-left"
                style={{ background: 'var(--bg-elevated)', cursor: analysing ? 'default' : 'pointer' }}>
                {analysing
                  ? <TrendingUp size={13} style={{ color: 'var(--accent)' }}/>
                  : analysisFailed
                    ? <AlertTriangle size={13} style={{ color: '#f87171' }}/>
                    : (statusCfg ? <span style={{ color: statusCfg.color }}>{statusCfg.icon}</span> : <TrendingUp size={13} style={{ color: 'var(--accent)' }}/>)
                }
                <span className="text-xs font-semibold" style={{ color: analysisFailed ? '#f87171' : 'var(--text-primary)' }}>
                  {analysing ? ANALYSIS_STEPS[Math.min(analysisStep, ANALYSIS_STEPS.length - 1)] : analysisFailed ? 'Analysis failed' : 'Programme Analysis'}
                </span>
                {analysis && !analysing && (
                  <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>
                    · {new Date(analysis.analysed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                )}
                {analysisFailed && (
                  <button onClick={e => { e.stopPropagation(); latest && runAnalysis(latest.id) }}
                    className="ml-2 text-xs px-2 py-0.5 rounded"
                    style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
                    Retry
                  </button>
                )}
                {!analysing && !analysisFailed && (
                  <span className="ml-auto" style={{ color: 'var(--text-muted)' }}>
                    {showAnalysis ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                  </span>
                )}
              </button>

              {/* Progress bar */}
              {analysing && (
                <div className="px-5 py-3" style={{ background: 'var(--bg-surface)' }}>
                  <div className="flex items-center justify-between mb-2">
                    {ANALYSIS_STEPS.map((step, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center text-xs shrink-0"
                          style={{
                            background: i <= analysisStep ? 'var(--accent)' : 'var(--bg-elevated)',
                            border: `1px solid ${i <= analysisStep ? 'var(--accent)' : 'var(--border)'}`,
                            color: i <= analysisStep ? '#000' : 'var(--text-muted)',
                            transition: 'all 0.4s ease'
                          }}>
                          {i < analysisStep ? '✓' : i === analysisStep ? <Loader2 size={8} className="animate-spin"/> : null}
                        </div>
                        <span className="text-xs hidden sm:block" style={{ color: i <= analysisStep ? 'var(--text-primary)' : 'var(--text-muted)', transition: 'color 0.4s' }}>
                          {step}
                        </span>
                        {i < ANALYSIS_STEPS.length - 1 && (
                          <div className="flex-1 h-px mx-2" style={{
                            background: i < analysisStep ? 'var(--accent)' : 'var(--border)',
                            minWidth: 16, transition: 'background 0.4s ease'
                          }}/>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showAnalysis && analysis && (
                <div className="px-5 py-4 space-y-4" style={{ background: 'var(--bg-surface)' }}>
                  {/* Summary */}
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{analysis.summary}</p>

                  {/* KPI row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Status', value: analysis.overall_status, color: statusCfg?.color ?? 'var(--text-primary)' },
                      { label: 'Slippage', value: analysis.slippage_days === 0 ? 'None' : `${analysis.slippage_days > 0 ? '+' : ''}${analysis.slippage_days} days`, color: analysis.slippage_days > 5 ? '#f87171' : analysis.slippage_days > 0 ? '#fb923c' : '#4ade80' },
                      { label: 'Forecast completion', value: analysis.completion_date_current ?? '—', color: 'var(--text-primary)' },
                      { label: 'Previous completion', value: analysis.completion_date_previous ?? '—', color: 'var(--text-muted)' },
                    ].map(k => (
                      <div key={k.label} className="rounded-lg p-3 border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{k.label}</p>
                        <p className="text-sm font-semibold" style={{ color: k.color }}>{k.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Status today */}
                  {analysis.status_today?.length > 0 && (
                    <div className="rounded-lg p-4 border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                        WHERE WE ARE TODAY — {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <ul className="space-y-1.5">
                        {analysis.status_today.map((bullet, i) => (
                          <li key={i} className="text-xs flex gap-2" style={{ color: 'var(--text-primary)' }}>
                            <span className="shrink-0 mt-0.5" style={{ color: 'var(--accent)' }}>•</span>
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Critical path */}
                  {analysis.critical_path?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>CRITICAL PATH</p>
                      <ul className="space-y-1">
                        {analysis.critical_path.map((c, i) => (
                          <li key={i} className="text-xs flex gap-2" style={{ color: 'var(--text-primary)' }}>
                            <span className="shrink-0" style={{ color: '#f87171' }}>▸</span>{c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Upcoming activities */}
                  {analysis.upcoming_activities?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>UPCOMING — NEXT 4 WEEKS</p>
                      <div className="space-y-2">
                        {analysis.upcoming_activities.map((a, i) => (
                          <div key={i} className="flex items-start gap-3 rounded-lg px-3 py-2.5 border"
                            style={{ background: 'var(--bg-elevated)', borderColor: IMPACT_COLOR[a.impact] + '40' }}>
                            <div className="shrink-0 text-center" style={{ minWidth: 44 }}>
                              <p className="text-xs font-bold" style={{ color: IMPACT_COLOR[a.impact] }}>
                                {a.days_away <= 0 ? 'NOW' : `${a.days_away}d`}
                              </p>
                              <p className="text-xs" style={{ color: 'var(--text-muted)', fontSize: 10 }}>{a.due}</p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{a.activity}</span>
                                <span className="text-xs px-1.5 py-0.5 rounded font-semibold shrink-0"
                                  style={{ background: IMPACT_COLOR[a.impact] + '20', color: IMPACT_COLOR[a.impact] }}>
                                  {a.impact}
                                </span>
                              </div>
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.note}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Key changes (revision comparison) */}
                  {analysis.key_changes?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>CHANGES FROM PREVIOUS REVISION</p>
                      <div className="space-y-1.5">
                        {analysis.key_changes.map((c, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <span className="px-1.5 py-0.5 rounded font-semibold shrink-0"
                              style={{ background: IMPACT_COLOR[c.impact] + '20', color: IMPACT_COLOR[c.impact] }}>
                              {c.impact}
                            </span>
                            <span className="font-medium shrink-0" style={{ color: 'var(--text-primary)' }}>{c.activity}</span>
                            <span style={{ color: 'var(--text-muted)' }}>— {c.change}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Risks + Recommendations */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {analysis.risks?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>RISKS</p>
                        <ul className="space-y-1">
                          {analysis.risks.map((r, i) => (
                            <li key={i} className="text-xs flex gap-2" style={{ color: 'var(--text-primary)' }}>
                              <AlertTriangle size={10} className="shrink-0 mt-0.5" style={{ color: '#fb923c' }}/>{r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {analysis.recommendations?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>RECOMMENDATIONS</p>
                        <ul className="space-y-1">
                          {analysis.recommendations.map((r, i) => (
                            <li key={i} className="text-xs flex gap-2" style={{ color: 'var(--text-primary)' }}>
                              <span className="shrink-0" style={{ color: '#4ade80' }}>✓</span>{r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PDF viewer */}
          {viewingProg && viewingUrl && (
            <div>
              <div className="flex items-center gap-2 px-5 py-2 border-b text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                <FileText size={12}/>
                <span>{viewingProg.file_name}</span>
                {viewingProg.notes && <span className="ml-2" style={{ color: 'var(--text-primary)' }}>· {viewingProg.notes}</span>}
                <a href={viewingUrl} target="_blank" rel="noopener noreferrer"
                  className="ml-auto text-xs hover:opacity-80" style={{ color: 'var(--accent)' }}>
                  Open in new tab ↗
                </a>
              </div>
              <iframe src={viewingUrl} className="w-full" style={{ height: '70vh', border: 'none', display: 'block' }}
                title={`Programme ${viewingProg.revision}`}/>
            </div>
          )}

          {viewingProg && !viewingUrl && programmes.length > 0 && (
            <div className="px-5 py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
              Unable to load programme PDF.{' '}
              <a href="#" onClick={async e => {
                e.preventDefault()
                const r = await fetch(`/api/construction/sites/${siteId}/programme/${viewingProg.id}/url`)
                if (r.ok) { const { url } = await r.json(); setUrls(prev => ({ ...prev, [viewingProg.id]: url })) }
              }} style={{ color: 'var(--accent)' }}>Retry</a>
            </div>
          )}
        </>
      )}
    </div>
  )
}
