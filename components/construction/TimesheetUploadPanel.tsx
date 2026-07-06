'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle,
  Loader2, ChevronRight, Users, Clock, RefreshCw,
} from 'lucide-react'
import DiscrepancyReviewModal from './DiscrepancyReviewModal'

interface UploadResult {
  weekEnd: string
  weekStart: string
  totalEntries: number
  matched: number
  unmatched: string[]
  discrepancies: number
  timesheetId: string
  replaced: boolean
}

type Step = { label: string; status: 'pending' | 'active' | 'done' | 'error' }

const STEPS = [
  'Parsing file',
  'Matching names to staff',
  'Saving entries',
  'Checking discrepancies',
]

export default function TimesheetUploadPanel({ siteId }: { siteId: string }) {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [steps, setSteps] = useState<Step[]>(STEPS.map(label => ({ label, status: 'pending' })))
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [showDiscrepancies, setShowDiscrepancies] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function setStep(idx: number, status: Step['status']) {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, status } : s))
    setProgress(Math.round(((idx + (status === 'done' ? 1 : 0.5)) / STEPS.length) * 100))
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) { setFile(f); setResult(null); setError('') }
  }, [])

  async function upload() {
    if (!file) return
    setUploading(true)
    setError('')
    setResult(null)
    setSteps(STEPS.map(label => ({ label, status: 'pending' })))
    setProgress(0)

    // Step 1: parsing (simulated — happens server-side)
    setStep(0, 'active')
    await delay(300)
    setStep(0, 'done')

    // Step 2: matching (simulated)
    setStep(1, 'active')
    await delay(400)
    setStep(1, 'done')

    // Step 3: saving — actual upload
    setStep(2, 'active')
    const fd = new FormData()
    fd.append('file', file)

    let data: UploadResult & { error?: string }
    try {
      const res = await fetch(`/api/construction/${siteId}/timesheets/upload`, { method: 'POST', body: fd })
      data = await res.json()
    } catch (e) {
      setStep(2, 'error')
      setError('Network error — please try again')
      setUploading(false)
      return
    }

    if (data.error) {
      setStep(2, 'error')
      setError(data.error)
      setUploading(false)
      return
    }

    setStep(2, 'done')

    // Step 4: discrepancy check
    setStep(3, 'active')
    await delay(300)
    setStep(3, 'done')
    setProgress(100)

    setResult(data)
    setUploading(false)
  }

  function reset() {
    setFile(null); setResult(null); setError('')
    setSteps(STEPS.map(label => ({ label, status: 'pending' })))
    setProgress(0)
  }

  const hasFile = !!file && !uploading && !result

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      {!result && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          className="rounded-xl border-2 border-dashed transition-colors cursor-pointer flex flex-col items-center justify-center gap-3 py-8 px-4"
          style={{
            borderColor: dragging ? 'var(--accent)' : file ? '#4ade8066' : 'var(--border)',
            background: dragging ? 'color-mix(in srgb, var(--accent) 5%, transparent)' : 'var(--bg-surface)',
          }}>
          <input ref={inputRef} type="file" accept=".xls,.xlsx" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setResult(null); setError('') } }} />

          {file ? (
            <>
              <FileSpreadsheet size={28} style={{ color: '#4ade80' }} />
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{file.name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {(file.size / 1024).toFixed(0)} KB · click to change
                </p>
              </div>
            </>
          ) : (
            <>
              <Upload size={24} style={{ color: 'var(--text-muted)' }} />
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Drop agency timesheet here
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  XLS or XLSX · GPW / OCU Dyce format
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Upload button */}
      {hasFile && (
        <button onClick={upload}
          className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
          style={{ background: 'var(--accent)', color: '#fff' }}>
          <Upload size={14} /> Analyse &amp; Import
        </button>
      )}

      {/* Progress steps */}
      {uploading && (
        <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
          {/* Bar */}
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: 'var(--accent)' }} />
          </div>
          {/* Steps */}
          <div className="space-y-2">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2.5 text-xs">
                {s.status === 'done'    && <CheckCircle2 size={13} style={{ color: '#4ade80', flexShrink: 0 }} />}
                {s.status === 'active'  && <Loader2 size={13} className="animate-spin" style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                {s.status === 'pending' && <div className="w-[13px] h-[13px] rounded-full border shrink-0" style={{ borderColor: 'var(--border)' }} />}
                {s.status === 'error'   && <XCircle size={13} style={{ color: '#f87171', flexShrink: 0 }} />}
                <span style={{
                  color: s.status === 'done' ? '#4ade80'
                    : s.status === 'active' ? 'var(--text-primary)'
                    : s.status === 'error' ? '#f87171'
                    : 'var(--text-muted)'
                }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border px-4 py-3 flex items-start gap-2 text-xs"
          style={{ borderColor: '#f8717144', background: '#f8717111', color: '#f87171' }}>
          <XCircle size={13} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
          {/* Header */}
          <div className="px-4 py-3 border-b flex items-center justify-between"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} style={{ color: '#4ade80' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {result.replaced ? 'Timesheet updated' : 'Timesheet imported'}
              </span>
            </div>
            <button onClick={reset} className="flex items-center gap-1 text-xs hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}>
              <RefreshCw size={11} /> Upload another
            </button>
          </div>

          {/* Week */}
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Week ending</p>
            <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>
              {new Date(result.weekEnd).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 divide-x" style={{ borderColor: 'var(--border)' }}>
            {[
              { icon: <Clock size={13} />, value: result.totalEntries, label: 'Entries', color: 'var(--text-primary)' },
              { icon: <Users size={13} />, value: result.matched, label: 'Matched', color: '#4ade80' },
              { icon: <AlertTriangle size={13} />, value: result.discrepancies, label: 'Discrepancies', color: result.discrepancies > 0 ? '#fb923c' : 'var(--text-muted)' },
            ].map(s => (
              <div key={s.label} className="px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1" style={{ color: s.color }}>{s.icon}</div>
                <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Unmatched names */}
          {result.unmatched.length > 0 && (
            <div className="px-4 py-3 border-t" style={{ borderColor: '#fb923c33', background: '#fb923c08' }}>
              <p className="text-xs font-medium mb-1.5" style={{ color: '#fb923c' }}>
                {result.unmatched.length} name{result.unmatched.length > 1 ? 's' : ''} not matched to staff card
              </p>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                {result.unmatched.join(', ')}
              </p>
              <a href="#personnel-matching" className="text-xs underline" style={{ color: '#fb923c' }}>
                Open matching panel →
              </a>
            </div>
          )}

          {/* Discrepancy CTA */}
          {result.discrepancies > 0 && (
            <div className="px-4 py-3 border-t flex items-center justify-between"
              style={{ borderColor: '#fb923c33', background: '#fb923c08' }}>
              <div>
                <p className="text-xs font-medium" style={{ color: '#fb923c' }}>
                  {result.discrepancies} hour discrepanc{result.discrepancies > 1 ? 'ies' : 'y'} flagged
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Agency hours differ from diary records by &gt;0.5h
                </p>
              </div>
              <button
                onClick={() => setShowDiscrepancies(true)}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium"
                style={{ background: '#fb923c22', color: '#fb923c' }}>
                Review &amp; sign off <ChevronRight size={11} />
              </button>
            </div>
          )}
        </div>
      )}

      {showDiscrepancies && result && (
        <DiscrepancyReviewModal
          siteId={siteId}
          weekStart={result.weekStart}
          weekEnd={result.weekEnd}
          onClose={() => setShowDiscrepancies(false)}
        />
      )}
    </div>
  )
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)) }
