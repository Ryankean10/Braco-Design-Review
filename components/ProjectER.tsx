'use client'

import { useState, useRef } from 'react'
import {
  FileText, Sparkles, X, Upload, ChevronDown, ChevronRight,
  AlertCircle, CheckCircle, MessageSquare, Scale, Send, Quote,
  ListTodo, HardHat, Shield, History, Plus, ExternalLink,
  AlertTriangle, TrendingUp, FileSearch,
} from 'lucide-react'
import AIProgressBar from '@/components/AIProgressBar'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type InterrogatePosition = 'NOT_REQUIRED' | 'REQUIRED' | 'AMBIGUOUS' | 'NOT_COVERED' | 'PARTIALLY_REQUIRED'

interface InterrogateClause { ref: string; text: string; significance: string }
interface InterrogateResult {
  position: InterrogatePosition; position_label: string; summary: string
  clauses: InterrogateClause[]; argument: string; suggested_response: string
}

interface MissingStandard { ref: string; title: string; category: string; reason: string }

interface ErTask {
  id: string; task_text: string; category: string; stage: string
  added_to_construction: boolean; construction_activity_id: string | null
}

interface RagItem { area: string; rating: 'red' | 'amber' | 'green'; brief: string }

interface DeepRisk {
  area: string; rating: 'red' | 'amber'; detail: string
  clauses: string[]; mitigations: string[]
}

interface RegisterRow {
  risk: string; likelihood: string; impact: string; mitigation: string; owner: string
}

interface DeepAnalysis { overview: string; risks: DeepRisk[]; register: RegisterRow[] }

interface ErRevision { path: string; fileName: string; uploadedAt: string }

interface Props {
  projectId: string
  erStoragePath: string | null
  erFileName: string | null
  erMissingStandards: MissingStandard[]
  erAnalysedAt: string | null
  erRevisions: ErRevision[]
  erRagSummary: RagItem[] | null
  erRagAnalysedAt: string | null
  erDeepAnalysis: DeepAnalysis | null
  erDeepAnalysedAt: string | null
  initialTasks: ErTask[]
  constructionSiteId: string | null
  canUpload: boolean
  linkedStandardRefs: { ref: string; title: string }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const POSITION_STYLES: Record<InterrogatePosition, { bg: string; border: string; text: string; label: string }> = {
  NOT_REQUIRED:       { bg: '#052e16', border: '#166534', text: '#86efac', label: '✓ Not Required' },
  NOT_COVERED:        { bg: '#0c1a3a', border: '#1e3a8a', text: '#93c5fd', label: '◈ Not Covered in ER' },
  AMBIGUOUS:          { bg: '#2d1b00', border: '#854d0e', text: '#fcd34d', label: '⚠ Ambiguous' },
  PARTIALLY_REQUIRED: { bg: '#2d1b00', border: '#92400e', text: '#fdba74', label: '◑ Partially Required' },
  REQUIRED:           { bg: '#3f1212', border: '#7f1d1d', text: '#fca5a5', label: '✗ Required by ER' },
}

const RAG_CFG = {
  red:   { bg: '#3f1212', border: '#7f1d1d', dot: '#ef4444', text: '#fca5a5' },
  amber: { bg: '#2d1b00', border: '#854d0e', dot: '#f59e0b', text: '#fcd34d' },
  green: { bg: '#052e16', border: '#166534', dot: '#22c55e', text: '#86efac' },
}

function fmtDate(s: string | null) {
  if (!s) return ''
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProjectER({
  projectId,
  erStoragePath: initStoragePath,
  erFileName: initFileName,
  erMissingStandards: initMissing,
  erAnalysedAt: initAnalysedAt,
  erRevisions: initRevisions,
  erRagSummary: initRag,
  erRagAnalysedAt: initRagAt,
  erDeepAnalysis: initDeep,
  erDeepAnalysedAt: initDeepAt,
  initialTasks,
  constructionSiteId,
  canUpload,
  linkedStandardRefs,
}: Props) {
  const supabase = createClient()

  // ── Core ER state ──────────────────────────────────────────────────────────
  const [storagePath, setStoragePath] = useState(initStoragePath)
  const [fileName, setFileName] = useState(initFileName)
  const [missing, setMissing] = useState<MissingStandard[]>(initMissing ?? [])
  const [analysedAt, setAnalysedAt] = useState(initAnalysedAt)
  const [revisions, setRevisions] = useState<ErRevision[]>(initRevisions ?? [])
  const [uploading, setUploading] = useState(false)
  const [analysing, setAnalysing] = useState(false)
  const [analyseError, setAnalyseError] = useState('')
  const [analyseResult, setAnalyseResult] = useState<{ linked: number } | null>(null)
  const [expandedMissing, setExpandedMissing] = useState(true)
  const [dismissedMissing, setDismissedMissing] = useState<Set<string>>(new Set())
  const [showRevisions, setShowRevisions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Task state ─────────────────────────────────────────────────────────────
  const [tasks, setTasks] = useState<ErTask[]>(initialTasks)
  const [extractingTasks, setExtractingTasks] = useState(false)
  const [taskError, setTaskError] = useState('')
  const [addingTask, setAddingTask] = useState<string | null>(null)
  const [taskSection, setTaskSection] = useState(true)
  const [taskFilter, setTaskFilter] = useState<string>('all')

  // ── RAG state ──────────────────────────────────────────────────────────────
  const [ragItems, setRagItems] = useState<RagItem[]>(initRag ?? [])
  const [ragAt, setRagAt] = useState(initRagAt)
  const [runningRag, setRunningRag] = useState(false)
  const [ragError, setRagError] = useState('')

  // ── Deep analysis state ────────────────────────────────────────────────────
  const [deepAnalysis, setDeepAnalysis] = useState<DeepAnalysis | null>(initDeep)
  const [deepAt, setDeepAt] = useState(initDeepAt)
  const [runningDeep, setRunningDeep] = useState(false)
  const [deepError, setDeepError] = useState('')
  const [deepOpen, setDeepOpen] = useState(false)
  const [expandedRisk, setExpandedRisk] = useState<string | null>(null)

  // ── Combined run state ─────────────────────────────────────────────────────
  const [runningAll, setRunningAll] = useState(false)
  const [allProgress, setAllProgress] = useState<{ standards: 'idle'|'running'|'done'|'error', tasks: 'idle'|'running'|'done'|'error', rag: 'idle'|'running'|'done'|'error' }>({ standards: 'idle', tasks: 'idle', rag: 'idle' })
  const [allError, setAllError] = useState('')

  // ── Interrogator state ─────────────────────────────────────────────────────
  const [question, setQuestion] = useState('')
  const [interrogating, setInterrogating] = useState(false)
  const [interrogateResult, setInterrogateResult] = useState<InterrogateResult | null>(null)
  const [interrogateError, setInterrogateError] = useState('')
  const [askedQuestion, setAskedQuestion] = useState('')

  // ── Upload / revision management ───────────────────────────────────────────

  async function handleUpload(file: File) {
    if (!file || file.type !== 'application/pdf') { setAnalyseError('Please upload a PDF file'); return }
    setUploading(true)
    setAnalyseError('')

    const path = `${projectId}/er/${Date.now()}-${file.name.replace(/\s+/g, '_')}`

    const { error: uploadErr } = await supabase.storage.from('documents').upload(path, file, { upsert: false })
    if (uploadErr) { setAnalyseError(`Upload failed: ${uploadErr.message}`); setUploading(false); return }

    // Archive current revision before replacing
    const newRevisions: ErRevision[] = storagePath && fileName
      ? [...revisions, { path: storagePath, fileName, uploadedAt: new Date().toISOString() }]
      : revisions

    const { error: dbErr } = await supabase.from('projects').update({
      er_storage_path: path,
      er_file_name: file.name,
      er_revisions: newRevisions,
    }).eq('id', projectId)

    if (dbErr) { setAnalyseError(`Failed to save: ${dbErr.message}`); setUploading(false); return }

    setStoragePath(path)
    setFileName(file.name)
    setRevisions(newRevisions)
    setAnalyseResult(null)
    setUploading(false)
  }

  async function removeER() {
    if (storagePath) await supabase.storage.from('documents').remove([storagePath])
    await supabase.from('projects').update({
      er_storage_path: null, er_file_name: null,
      er_missing_standards: [], er_analysed_at: null,
    }).eq('id', projectId)
    setStoragePath(null); setFileName(null); setMissing([]); setAnalysedAt(null); setAnalyseResult(null)
  }

  // ── Standards analysis ─────────────────────────────────────────────────────

  async function analyse() {
    setAnalysing(true); setAnalyseError(''); setAnalyseResult(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/analyse-er`, { method: 'POST' })
      const text = await res.text()
      let data: any
      try { data = JSON.parse(text) } catch { throw new Error(text.slice(0, 300) || 'Server error') }
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed')
      setAnalyseResult({ linked: data.linked })
      setMissing(data.missing ?? [])
      setAnalysedAt(new Date().toISOString())
      setExpandedMissing(true)
      setDismissedMissing(new Set())
    } catch (e: any) { setAnalyseError(e.message) }
    finally { setAnalysing(false) }
  }

  // ── Task extraction ────────────────────────────────────────────────────────

  async function extractTasks() {
    setExtractingTasks(true); setTaskError('')
    try {
      const res = await fetch(`/api/projects/${projectId}/er-extract-tasks`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Extraction failed')
      setTasks(data.tasks ?? [])
      setTaskSection(true)
    } catch (e: any) { setTaskError(e.message) }
    finally { setExtractingTasks(false) }
  }

  async function addToConstruction(taskId: string) {
    if (!constructionSiteId) return
    setAddingTask(taskId)
    try {
      const res = await fetch(`/api/projects/${projectId}/er-task-to-construction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, siteId: constructionSiteId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, added_to_construction: true, construction_activity_id: data.activityId } : t))
    } catch (e: any) { setTaskError(e.message) }
    finally { setAddingTask(null) }
  }

  // ── RAG assessment ─────────────────────────────────────────────────────────

  async function runRag() {
    setRunningRag(true); setRagError('')
    try {
      const res = await fetch(`/api/projects/${projectId}/er-rag`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'RAG failed')
      setRagItems(data.items ?? [])
      setRagAt(new Date().toISOString())
    } catch (e: any) { setRagError(e.message) }
    finally { setRunningRag(false) }
  }

  // ── Combined analyse all ───────────────────────────────────────────────────

  async function runAll() {
    setRunningAll(true)
    setAllError('')
    setAllProgress({ standards: 'running', tasks: 'running', rag: 'running' })

    const [stdRes, taskRes, ragRes] = await Promise.allSettled([
      fetch(`/api/projects/${projectId}/analyse-er`, { method: 'POST' })
        .then(r => r.json()),
      fetch(`/api/projects/${projectId}/er-extract-tasks`, { method: 'POST' })
        .then(r => r.json()),
      fetch(`/api/projects/${projectId}/er-rag`, { method: 'POST' })
        .then(r => r.json()),
    ])

    const errors: string[] = []

    if (stdRes.status === 'fulfilled') {
      const d = stdRes.value
      setAnalyseResult({ linked: d.linked ?? 0 })
      setMissing(d.missing ?? [])
      setAnalysedAt(new Date().toISOString())
      setExpandedMissing(true)
      setDismissedMissing(new Set())
      setAllProgress(p => ({ ...p, standards: 'done' }))
    } else {
      errors.push(`Standards: ${stdRes.reason?.message ?? 'failed'}`)
      setAllProgress(p => ({ ...p, standards: 'error' }))
    }

    if (taskRes.status === 'fulfilled') {
      setTasks(taskRes.value.tasks ?? [])
      setTaskSection(true)
      setAllProgress(p => ({ ...p, tasks: 'done' }))
    } else {
      errors.push(`Tasks: ${taskRes.reason?.message ?? 'failed'}`)
      setAllProgress(p => ({ ...p, tasks: 'error' }))
    }

    if (ragRes.status === 'fulfilled') {
      setRagItems(ragRes.value.items ?? [])
      setRagAt(new Date().toISOString())
      setAllProgress(p => ({ ...p, rag: 'done' }))
    } else {
      errors.push(`Risk: ${ragRes.reason?.message ?? 'failed'}`)
      setAllProgress(p => ({ ...p, rag: 'error' }))
    }

    if (errors.length) setAllError(errors.join(' · '))
    setRunningAll(false)
  }

  // ── Deep analysis ──────────────────────────────────────────────────────────

  async function runDeepAnalysis() {
    setRunningDeep(true); setDeepError('')
    try {
      const res = await fetch(`/api/projects/${projectId}/er-deep-analysis`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Deep analysis failed')
      setDeepAnalysis(data)
      setDeepAt(new Date().toISOString())
      setDeepOpen(true)
    } catch (e: any) { setDeepError(e.message) }
    finally { setRunningDeep(false) }
  }

  // ── Commercial interrogator ────────────────────────────────────────────────

  async function interrogate() {
    if (!question.trim()) return
    setInterrogating(true); setInterrogateError(''); setInterrogateResult(null); setAskedQuestion(question)
    try {
      const res = await fetch(`/api/projects/${projectId}/er-interrogate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Interrogation failed')
      setInterrogateResult(data.result)
    } catch (e: any) { setInterrogateError(e.message) }
    finally { setInterrogating(false) }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const visibleMissing = missing.filter(m => !dismissedMissing.has(m.ref))
  const stages = ['all', ...Array.from(new Set(tasks.map(t => t.stage)))]
  const filteredTasks = taskFilter === 'all' ? tasks : tasks.filter(t => t.stage === taskFilter)
  const taskAddedCount = tasks.filter(t => t.added_to_construction).length

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <FileText size={16} style={{ color: 'var(--accent)' }} />
        <div className="flex-1">
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Contract / Employer's Requirements</span>
          <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(108,114,245,0.15)', color: 'var(--accent)' }}>Master Reference</span>
        </div>
        {storagePath && canUpload && (
          <button onClick={removeER} className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            <X size={12} /> Remove
          </button>
        )}
      </div>

      <div className="p-5 space-y-5" style={{ background: 'var(--bg-elevated)' }}>

        {/* ── Upload zone ── */}
        {!storagePath && canUpload && (
          <div
            className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:opacity-80 transition-opacity"
            style={{ borderColor: 'var(--border)' }}
            onClick={() => inputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleUpload(f) }}
          >
            <Upload size={24} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
              {uploading ? 'Uploading…' : 'Upload Contract / Employer\'s Requirements'}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Drop the PDF here or click to browse. AI will extract tasks, standards and run a commercial risk assessment.
            </p>
            <input ref={inputRef} type="file" accept=".pdf" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
          </div>
        )}

        {!storagePath && !canUpload && (
          <div className="rounded-xl border px-4 py-6 text-center" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No contract uploaded yet.</p>
          </div>
        )}

        {/* ── Current document + revision history ── */}
        {storagePath && fileName && (
          <div className="space-y-2">
            <div className="flex items-center gap-3 rounded-xl border px-4 py-3" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <FileText size={20} style={{ color: 'var(--accent)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{fileName}</p>
                {analysedAt && (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Standards analysed {fmtDate(analysedAt)}</p>
                )}
              </div>
              {canUpload && (
                <button onClick={() => inputRef.current?.click()}
                  className="text-xs px-2.5 py-1 rounded-lg border flex-shrink-0"
                  style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                  Upload revision
                </button>
              )}
              <input ref={inputRef} type="file" accept=".pdf" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
            </div>

            {/* Revision history */}
            {revisions.length > 0 && (
              <button onClick={() => setShowRevisions(v => !v)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5"
                style={{ color: 'var(--text-muted)' }}>
                <History size={11} />
                {revisions.length} previous revision{revisions.length !== 1 ? 's' : ''}
                {showRevisions ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              </button>
            )}
            {showRevisions && (
              <div className="rounded-lg border divide-y" style={{ borderColor: 'var(--border)' }}>
                {[...revisions].reverse().map((r, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5" style={{ background: 'var(--bg-surface)' }}>
                    <FileText size={13} style={{ color: 'var(--text-muted)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>{r.fileName}</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Replaced {fmtDate(r.uploadedAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Combined analyse button ── */}
        {storagePath && !runningAll && (
          <button onClick={runAll} disabled={uploading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
            style={{ background: 'linear-gradient(135deg, var(--accent), #a855f7)' }}>
            <Sparkles size={15} />
            {analysedAt || tasks.length > 0 || ragItems.length > 0 ? 'Re-analyse contract' : 'Analyse contract'}
          </button>
        )}

        {runningAll && (
          <div className="rounded-xl border p-4 space-y-3" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Analysing contract — running 3 analyses in parallel…</p>
            {(['standards', 'tasks', 'rag'] as const).map(key => {
              const labels = { standards: 'Standards & gaps', tasks: 'Construction tasks', rag: 'Contractual risk (RAG)' }
              const st = allProgress[key]
              return (
                <div key={key} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{
                    background: st === 'done' ? '#22c55e' : st === 'error' ? '#ef4444' : st === 'running' ? 'var(--accent)' : 'var(--border)',
                    animation: st === 'running' ? 'pulse 1.5s infinite' : undefined,
                  }} />
                  <span className="text-xs flex-1" style={{ color: st === 'done' ? '#86efac' : st === 'error' ? '#fca5a5' : 'var(--text-muted)' }}>
                    {labels[key]}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {st === 'done' ? '✓ Done' : st === 'error' ? '✗ Failed' : st === 'running' ? 'Running…' : '—'}
                  </span>
                </div>
              )
            })}
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>All three run simultaneously — typically 30–60 seconds</p>
          </div>
        )}

        {allError && (
          <div className="flex items-start gap-2 rounded-lg px-3 py-2.5" style={{ background: '#3f1212', border: '1px solid #7f1d1d' }}>
            <AlertCircle size={13} className="mt-0.5 flex-shrink-0" style={{ color: '#f87171' }} />
            <p className="text-xs" style={{ color: '#fca5a5' }}>{allError}</p>
          </div>
        )}

        {analyseResult && !runningAll && (
          <div className="flex items-start gap-2 rounded-lg px-3 py-2.5" style={{ background: '#052e16', border: '1px solid #166534' }}>
            <CheckCircle size={13} className="mt-0.5 flex-shrink-0" style={{ color: '#22c55e' }} />
            <p className="text-xs" style={{ color: '#86efac' }}>
              {analyseResult.linked > 0
                ? `${analyseResult.linked} standard${analyseResult.linked !== 1 ? 's' : ''} linked.`
                : 'Standards reviewed.'
              }
              {` ${tasks.length} construction tasks extracted.`}
              {ragItems.length > 0 && ` ${ragItems.filter(r => r.rating === 'red').length} red / ${ragItems.filter(r => r.rating === 'amber').length} amber risks identified.`}
            </p>
          </div>
        )}

        {/* Linked standards pills */}
        {linkedStandardRefs.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              Standards linked to this project
            </p>
            <div className="flex flex-wrap gap-1.5">
              {linkedStandardRefs.map(s => (
                <span key={s.ref}
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium border"
                  style={{ background: 'rgba(108,114,245,0.1)', borderColor: 'rgba(108,114,245,0.3)', color: 'var(--accent)' }}
                  title={s.title}>
                  {s.ref}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Gap list */}
        {visibleMissing.length > 0 && (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#854d0e' }}>
            <button onClick={() => setExpandedMissing(e => !e)}
              className="w-full flex items-center justify-between px-4 py-3"
              style={{ background: '#431407' }}>
              <div className="flex items-center gap-2">
                <AlertCircle size={13} style={{ color: '#fb923c' }} />
                <span className="text-xs font-semibold" style={{ color: '#fed7aa' }}>
                  {visibleMissing.length} standard{visibleMissing.length !== 1 ? 's' : ''} referenced — not yet in library
                </span>
              </div>
              {expandedMissing ? <ChevronDown size={13} style={{ color: '#fb923c' }} /> : <ChevronRight size={13} style={{ color: '#fb923c' }} />}
            </button>
            {expandedMissing && (
              <div className="divide-y" style={{ borderColor: '#7c2d12' }}>
                {visibleMissing.map(m => (
                  <div key={m.ref} className="px-4 py-3 flex items-start gap-3" style={{ background: '#1c0a00' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-semibold" style={{ color: '#fb923c' }}>{m.ref}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#431407', color: '#fed7aa' }}>{m.category}</span>
                      </div>
                      <p className="text-xs font-medium mb-0.5" style={{ color: '#fed7aa' }}>{m.title}</p>
                      <p className="text-[10px] leading-relaxed" style={{ color: '#fdba74' }}>{m.reason}</p>
                    </div>
                    <button onClick={() => setDismissedMissing(prev => new Set([...prev, m.ref]))} style={{ color: '#fb923c' }}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ── Section 2: Task Extraction ── */}
        {storagePath && (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <ListTodo size={13} style={{ color: '#34d399' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Contract Tasks</span>
                {tasks.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>
                    {tasks.length} tasks · {taskAddedCount} added to construction
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {tasks.length > 0 && (
                  <button onClick={() => setTaskSection(v => !v)} style={{ color: 'var(--text-muted)' }}>
                    {taskSection ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </button>
                )}
                <button onClick={extractTasks} disabled={extractingTasks || runningAll}
                  className="text-[10px] px-2 py-1 rounded border disabled:opacity-40"
                  style={{ borderColor: '#34d39944', color: '#34d399' }}>
                  {extractingTasks ? 'Re-running…' : 'Re-run'}
                </button>
              </div>
            </div>

            {extractingTasks && (
              <div className="p-4" style={{ background: 'var(--bg-elevated)' }}>
                <AIProgressBar stages={[
                  { pct: 15, label: 'Downloading document…',         ms: 800  },
                  { pct: 30, label: 'Extracting text from PDF…',     ms: 1200 },
                  { pct: 55, label: 'AI reading contract tasks…',    ms: 8000 },
                  { pct: 85, label: 'Categorising and staging…',     ms: 5000 },
                ]} note="Typically 20–40 seconds" />
              </div>
            )}

            {taskError && (
              <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5" style={{ background: '#3f1212', border: '1px solid #7f1d1d' }}>
                <AlertCircle size={13} className="mt-0.5 flex-shrink-0" style={{ color: '#f87171' }} />
                <p className="text-xs" style={{ color: '#fca5a5' }}>{taskError}</p>
              </div>
            )}

            {tasks.length > 0 && taskSection && (
              <div style={{ background: 'var(--bg-elevated)' }}>
                {/* Stage filter */}
                <div className="px-4 pt-3 pb-2 flex gap-1.5 flex-wrap">
                  {stages.map(s => (
                    <button key={s} onClick={() => setTaskFilter(s)}
                      className="text-[10px] px-2 py-0.5 rounded-full border transition-colors"
                      style={{
                        background: taskFilter === s ? 'rgba(52,211,153,0.15)' : 'transparent',
                        borderColor: taskFilter === s ? '#34d399' : 'var(--border)',
                        color: taskFilter === s ? '#34d399' : 'var(--text-muted)',
                      }}>
                      {s === 'all' ? 'All stages' : s}
                    </button>
                  ))}
                </div>

                <div className="divide-y px-4 pb-3" style={{ borderColor: 'var(--border)' }}>
                  {filteredTasks.map(task => (
                    <div key={task.id} className="py-2.5 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs" style={{ color: task.added_to_construction ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                          {task.task_text}
                        </p>
                        <div className="flex gap-1.5 mt-1 flex-wrap">
                          <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>
                            {task.stage}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                            {task.category}
                          </span>
                        </div>
                      </div>
                      {constructionSiteId ? (
                        task.added_to_construction ? (
                          <span className="flex items-center gap-1 text-[10px] flex-shrink-0" style={{ color: '#34d399' }}>
                            <CheckCircle size={11} /> Added
                          </span>
                        ) : (
                          <button
                            onClick={() => addToConstruction(task.id)}
                            disabled={addingTask === task.id}
                            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border flex-shrink-0 disabled:opacity-50"
                            style={{ borderColor: '#34d399', color: '#34d399' }}>
                            <HardHat size={10} />
                            {addingTask === task.id ? 'Adding…' : 'Add to construction'}
                          </button>
                        )
                      ) : (
                        <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                          No construction site
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ── Section 3: Commercial RAG ── */}
        {storagePath && (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <Shield size={13} style={{ color: '#a78bfa' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Commercial Risk Assessment</span>
                {ragAt && (
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>· {fmtDate(ragAt)}</span>
                )}
              </div>
              <button onClick={runRag} disabled={runningRag || runningAll}
                className="text-[10px] px-2 py-1 rounded border disabled:opacity-40"
                style={{ borderColor: '#a78bfa44', color: '#a78bfa' }}>
                {runningRag ? 'Re-running…' : 'Re-run'}
              </button>
            </div>

            {runningRag && (
              <div className="p-4" style={{ background: 'var(--bg-elevated)' }}>
                <AIProgressBar stages={[
                  { pct: 10, label: 'Downloading document…',          ms: 800  },
                  { pct: 25, label: 'Extracting text…',               ms: 1000 },
                  { pct: 50, label: 'AI reviewing commercial terms…', ms: 8000 },
                  { pct: 85, label: 'Rating risk areas…',             ms: 5000 },
                ]} note="Typically 20–40 seconds" />
              </div>
            )}

            {ragError && (
              <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5" style={{ background: '#3f1212', border: '1px solid #7f1d1d' }}>
                <AlertCircle size={13} className="mt-0.5 flex-shrink-0" style={{ color: '#f87171' }} />
                <p className="text-xs" style={{ color: '#fca5a5' }}>{ragError}</p>
              </div>
            )}

            {ragItems.length > 0 && (
              <div className="p-4 space-y-3" style={{ background: 'var(--bg-elevated)' }}>
                <div className="grid grid-cols-2 gap-2">
                  {ragItems.map((item, i) => {
                    const cfg = RAG_CFG[item.rating] ?? RAG_CFG.amber
                    return (
                      <div key={i} className="flex items-start gap-2.5 rounded-lg border px-3 py-2.5"
                        style={{ background: cfg.bg, borderColor: cfg.border }}>
                        <span className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: cfg.dot }} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium" style={{ color: cfg.text }}>{item.area}</p>
                          <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: cfg.text, opacity: 0.75 }}>{item.brief}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Analyse further */}
                {!deepOpen && (
                  <button
                    onClick={runDeepAnalysis}
                    disabled={runningDeep}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium border transition-opacity hover:opacity-80 disabled:opacity-50"
                    style={{ borderColor: '#7c3aed44', color: '#a78bfa', background: 'rgba(124,58,237,0.06)' }}>
                    <TrendingUp size={13} />
                    {runningDeep ? 'Running deep analysis…' : deepAnalysis ? 'View full analysis' : 'Analyse further'}
                  </button>
                )}

                {runningDeep && (
                  <AIProgressBar stages={[
                    { pct: 10, label: 'Downloading document…',           ms: 800   },
                    { pct: 20, label: 'Extracting text…',                ms: 1000  },
                    { pct: 40, label: 'AI reviewing all risk areas…',    ms: 10000 },
                    { pct: 65, label: 'Building commercial analysis…',   ms: 10000 },
                    { pct: 85, label: 'Generating risk register…',       ms: 8000  },
                  ]} note="Deep analysis — typically 60–90 seconds" />
                )}

                {deepError && (
                  <div className="flex items-start gap-2 rounded-lg px-3 py-2.5" style={{ background: '#3f1212', border: '1px solid #7f1d1d' }}>
                    <AlertCircle size={13} className="mt-0.5 flex-shrink-0" style={{ color: '#f87171' }} />
                    <p className="text-xs" style={{ color: '#fca5a5' }}>{deepError}</p>
                  </div>
                )}

                {/* Deep analysis results */}
                {deepAnalysis && deepOpen && (
                  <div className="space-y-4 rounded-xl border p-4" style={{ background: 'var(--bg-surface)', borderColor: '#7c3aed44' }}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold" style={{ color: '#a78bfa' }}>Full Commercial Analysis</p>
                      <div className="flex items-center gap-2">
                        {deepAt && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{fmtDate(deepAt)}</span>}
                        <button onClick={runDeepAnalysis} disabled={runningDeep}
                          className="text-[10px] px-2 py-1 rounded border disabled:opacity-50"
                          style={{ borderColor: '#7c3aed44', color: '#a78bfa' }}>
                          Re-run
                        </button>
                        <button onClick={() => setDeepOpen(false)} style={{ color: 'var(--text-muted)' }}>
                          <ChevronDown size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Overview */}
                    <div className="rounded-lg border p-3" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Executive Overview</p>
                      {deepAnalysis.overview.split('\n').filter(Boolean).map((p, i) => (
                        <p key={i} className="text-xs leading-relaxed mb-1.5" style={{ color: 'var(--text-primary)' }}>{p}</p>
                      ))}
                    </div>

                    {/* Risk details */}
                    {deepAnalysis.risks.map((risk, i) => {
                      const cfg = RAG_CFG[risk.rating] ?? RAG_CFG.amber
                      const isOpen = expandedRisk === risk.area
                      return (
                        <div key={i} className="rounded-lg border overflow-hidden" style={{ borderColor: cfg.border }}>
                          <button
                            onClick={() => setExpandedRisk(isOpen ? null : risk.area)}
                            className="w-full flex items-center justify-between px-4 py-3"
                            style={{ background: cfg.bg }}>
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
                              <span className="text-xs font-semibold" style={{ color: cfg.text }}>{risk.area}</span>
                            </div>
                            {isOpen ? <ChevronDown size={12} style={{ color: cfg.text }} /> : <ChevronRight size={12} style={{ color: cfg.text }} />}
                          </button>
                          {isOpen && (
                            <div className="p-4 space-y-3" style={{ background: 'var(--bg-elevated)' }}>
                              {risk.detail.split('\n').filter(Boolean).map((p, j) => (
                                <p key={j} className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>{p}</p>
                              ))}
                              {risk.clauses?.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>Relevant clauses</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {risk.clauses.map((c, j) => (
                                      <span key={j} className="text-[10px] px-2 py-0.5 rounded border font-mono"
                                        style={{ background: cfg.bg, borderColor: cfg.border, color: cfg.text }}>{c}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {risk.mitigations?.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>Suggested mitigations</p>
                                  <ul className="space-y-1">
                                    {risk.mitigations.map((m, j) => (
                                      <li key={j} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-primary)' }}>
                                        <span style={{ color: cfg.dot }}>→</span> {m}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* Risk register */}
                    {deepAnalysis.register?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Risk Register</p>
                        <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                          <div className="grid grid-cols-12 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide border-b"
                            style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                            <span className="col-span-4">Risk</span>
                            <span className="col-span-1 text-center">L</span>
                            <span className="col-span-1 text-center">I</span>
                            <span className="col-span-4">Mitigation</span>
                            <span className="col-span-2">Owner</span>
                          </div>
                          {deepAnalysis.register.map((row, i) => {
                            const lColor = row.likelihood === 'High' ? '#ef4444' : row.likelihood === 'Medium' ? '#f59e0b' : '#22c55e'
                            const iColor = row.impact === 'High' ? '#ef4444' : row.impact === 'Medium' ? '#f59e0b' : '#22c55e'
                            return (
                              <div key={i} className="grid grid-cols-12 px-3 py-2.5 items-start border-b last:border-0 text-xs"
                                style={{ borderColor: 'var(--border)', background: i % 2 === 0 ? 'var(--bg-elevated)' : 'var(--bg-surface)' }}>
                                <span className="col-span-4 pr-2" style={{ color: 'var(--text-primary)' }}>{row.risk}</span>
                                <span className="col-span-1 text-center font-bold text-[10px]" style={{ color: lColor }}>{row.likelihood?.[0]}</span>
                                <span className="col-span-1 text-center font-bold text-[10px]" style={{ color: iColor }}>{row.impact?.[0]}</span>
                                <span className="col-span-4 pr-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>{row.mitigation}</span>
                                <span className="col-span-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>{row.owner}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {deepAnalysis && !deepOpen && (
                  <button onClick={() => setDeepOpen(true)}
                    className="w-full text-xs py-2 hover:opacity-70 transition-opacity"
                    style={{ color: '#a78bfa' }}>
                    Show full analysis ↓
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ── Section 4: Commercial Interrogator (existing) ── */}
        {storagePath && (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <Scale size={13} style={{ color: '#a78bfa' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Commercial Interrogator</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full ml-1" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>AI · Commercial Bias</span>
            </div>

            <div className="p-4 space-y-3" style={{ background: 'var(--bg-elevated)' }}>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Ask a question about the contract. The AI responds with a commercial bias — looking for arguments that the requirement is not in scope, advisory only, or a variation.
              </p>

              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <MessageSquare size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                  <input type="text" value={question} onChange={e => setQuestion(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !interrogating) interrogate() }}
                    placeholder="e.g. Is traffic management included in our scope?"
                    className="w-full rounded-lg border pl-8 pr-3 py-2.5 text-sm"
                    style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                    disabled={interrogating} />
                </div>
                <button onClick={interrogate} disabled={interrogating || !question.trim()}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 shrink-0"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
                  <Send size={11} />
                  {interrogating ? 'Searching…' : 'Search'}
                </button>
              </div>

              {interrogating && (
                <AIProgressBar stages={[
                  { pct: 10, label: 'Downloading document…',          ms: 800  },
                  { pct: 25, label: 'Extracting text…',               ms: 1000 },
                  { pct: 45, label: 'Searching for relevant clauses…',ms: 5000 },
                  { pct: 70, label: 'Building commercial argument…',  ms: 8000 },
                  { pct: 90, label: 'Drafting suggested response…',   ms: 5000 },
                ]} note="Typically 20–45 seconds" />
              )}

              {interrogateError && (
                <div className="flex items-start gap-2 rounded-lg px-3 py-2.5" style={{ background: '#3f1212', border: '1px solid #7f1d1d' }}>
                  <AlertCircle size={13} className="mt-0.5 shrink-0" style={{ color: '#f87171' }} />
                  <p className="text-xs" style={{ color: '#fca5a5' }}>{interrogateError}</p>
                </div>
              )}

              {interrogateResult && (() => {
                const pos = interrogateResult.position in POSITION_STYLES ? interrogateResult.position : 'AMBIGUOUS'
                const style = POSITION_STYLES[pos]
                return (
                  <div className="space-y-3">
                    <div className="rounded-lg px-3 py-2.5 border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                      <p className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Question asked:</p>
                      <p className="text-xs italic" style={{ color: 'var(--text-primary)' }}>"{askedQuestion}"</p>
                    </div>

                    <div className="rounded-lg px-4 py-3 border" style={{ background: style.bg, borderColor: style.border }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold" style={{ color: style.text }}>{style.label}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full border"
                          style={{ background: style.bg, borderColor: style.border, color: style.text }}>
                          {interrogateResult.position_label}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: style.text }}>{interrogateResult.summary}</p>
                    </div>

                    {interrogateResult.clauses.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Relevant clauses found</p>
                        {interrogateResult.clauses.map((clause, i) => (
                          <div key={i} className="rounded-lg border p-3" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Quote size={10} style={{ color: '#a78bfa' }} />
                              <span className="text-[10px] font-mono font-semibold" style={{ color: '#a78bfa' }}>{clause.ref}</span>
                            </div>
                            <p className="text-xs italic mb-1.5 leading-relaxed" style={{ color: 'var(--text-primary)' }}>"{clause.text}"</p>
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{clause.significance}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {interrogateResult.clauses.length === 0 && (
                      <div className="rounded-lg border px-3 py-2.5 text-xs"
                        style={{ background: '#0c1a3a', borderColor: '#1e3a8a', color: '#93c5fd' }}>
                        No specific clauses found — supports a "not in scope" position.
                      </div>
                    )}

                    <div className="rounded-lg border p-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Commercial Argument</p>
                      <div className="text-xs leading-relaxed space-y-2" style={{ color: 'var(--text-primary)' }}>
                        {interrogateResult.argument.split('\n').filter(Boolean).map((para, i) => <p key={i}>{para}</p>)}
                      </div>
                    </div>

                    <div className="rounded-lg border p-4" style={{ background: 'rgba(167,139,250,0.06)', borderColor: '#7c3aed44' }}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#a78bfa' }}>Suggested Response</p>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>{interrogateResult.suggested_response}</p>
                      <button onClick={() => navigator.clipboard.writeText(interrogateResult.suggested_response)}
                        className="mt-2 text-[10px] px-2 py-1 rounded border hover:opacity-70"
                        style={{ borderColor: '#7c3aed44', color: '#a78bfa' }}>
                        Copy to clipboard
                      </button>
                    </div>

                    <button onClick={() => { setInterrogateResult(null); setQuestion(''); setAskedQuestion('') }}
                      className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      ← Ask another question
                    </button>
                  </div>
                )
              })()}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
