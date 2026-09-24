'use client'

import { useState, useRef } from 'react'

interface FileEntry {
  file: File
  description: string
  status: 'pending' | 'uploading' | 'done' | 'error'
  errorMsg?: string
}

interface Props {
  companyName: string
  logoUrl: string | null
  accentColor: string
}

export default function ClientTemplateUpload({ companyName, logoUrl, accentColor }: Props) {
  const [step, setStep] = useState<'consent' | 'upload' | 'success'>('consent')
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [globalError, setGlobalError] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const newEntries: FileEntry[] = Array.from(files).map(f => ({
      file: f,
      description: '',
      status: 'pending',
    }))
    setEntries(prev => [...prev, ...newEntries])
  }

  const updateDesc = (idx: number, val: string) =>
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, description: val } : e))

  const removeEntry = (idx: number) =>
    setEntries(prev => prev.filter((_, i) => i !== idx))

  const canSubmit =
    entries.length > 0 &&
    entries.every(e => e.description.trim().length > 0) &&
    !submitting

  async function handleSubmit() {
    setSubmitting(true)
    setGlobalError('')

    const form = new FormData()
    entries.forEach((e, i) => {
      form.append(`file_${i}`, e.file)
      form.append(`desc_${i}`, e.description.trim())
    })

    // Mark all as uploading
    setEntries(prev => prev.map(e => ({ ...e, status: 'uploading' as const })))

    const res = await fetch('/api/client-upload', { method: 'POST', body: form })
    const json = await res.json()

    if (!res.ok || !json.ok) {
      setGlobalError(json.error ?? 'Upload failed. Please try again.')
      setEntries(prev => prev.map(e => ({ ...e, status: 'error' as const })))
      setSubmitting(false)
      return
    }

    setEntries(prev => prev.map(e => ({ ...e, status: 'done' as const })))
    setEmailError(json.emailError ?? null)
    setStep('success')
    setSubmitting(false)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    addFiles(e.dataTransfer.files)
  }

  const surfaceStyle = { background: 'var(--bg-surface, #1e1e2e)', borderColor: 'var(--border, #333)' }
  const mutedStyle = { color: 'var(--text-muted, #888)' }
  const primaryStyle = { color: 'var(--text-primary, #fff)' }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: 'var(--bg-page, #111)' }}>
      <div className="w-full max-w-xl">
        {/* Logo / header */}
        <div className="flex flex-col items-center mb-8 gap-3">
          {logoUrl && <img src={logoUrl} alt={companyName} className="h-12 object-contain" />}
          <p className="text-xs font-medium tracking-widest uppercase" style={{ color: accentColor }}>Safe T Consultancy</p>
        </div>

        {/* ── CONSENT STEP ── */}
        {step === 'consent' && (
          <div className="rounded-2xl border p-8 space-y-6" style={surfaceStyle}>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold" style={primaryStyle}>Welcome onboard, {companyName}</h1>
              <p className="text-sm" style={mutedStyle}>Let's get your documents set up</p>
            </div>

            <p className="text-sm leading-relaxed" style={primaryStyle}>
              Please upload a suite of templates or reference documents you require in the system so that we can ensure
              they are working perfectly when you fully start using the app.
            </p>

            <div className="rounded-xl border p-4 text-xs leading-relaxed space-y-2" style={{ ...surfaceStyle, borderColor: `${accentColor}44` }}>
              <p className="font-semibold text-sm" style={{ color: accentColor }}>Data &amp; Privacy Notice</p>
              <p style={mutedStyle}>
                By uploading documents to this system you accept that <strong style={primaryStyle}>Safe T Consultancy Ltd</strong> will
                have access to the information shared. Data will be stored in accordance with the Data Protection Act
                and will not be shared with any third parties.
              </p>
            </div>

            <button
              onClick={() => setStep('upload')}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90"
              style={{ background: accentColor }}
            >
              Continue to accept
            </button>
          </div>
        )}

        {/* ── UPLOAD STEP ── */}
        {step === 'upload' && (
          <div className="rounded-2xl border p-8 space-y-6" style={surfaceStyle}>
            <div>
              <h1 className="text-xl font-semibold" style={primaryStyle}>Upload your documents</h1>
              <p className="text-sm mt-0.5" style={mutedStyle}>Add a brief description to each file before uploading</p>
            </div>

            {/* Drop zone */}
            <div
              onDrop={onDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors hover:border-current"
              style={{ borderColor: `${accentColor}66` }}
            >
              <p className="text-sm font-medium" style={{ color: accentColor }}>Drop files here or click to browse</p>
              <p className="text-xs mt-1" style={mutedStyle}>Any document type · up to 50 MB each</p>
              <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                onChange={e => addFiles(e.target.files)}
              />
            </div>

            {/* File list */}
            {entries.length > 0 && (
              <div className="space-y-3">
                {entries.map((entry, idx) => (
                  <div key={idx} className="rounded-xl border p-4 space-y-2" style={{ ...surfaceStyle, background: 'var(--bg-elevated, #252535)' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={primaryStyle}>{entry.file.name}</p>
                        <p className="text-xs" style={mutedStyle}>{(entry.file.size / 1024).toFixed(0)} KB</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {entry.status === 'uploading' && <span className="text-xs" style={{ color: accentColor }}>Uploading…</span>}
                        {entry.status === 'done' && <span className="text-xs text-green-400">✓ Done</span>}
                        {entry.status === 'error' && <span className="text-xs text-red-400">✗ Failed</span>}
                        {entry.status === 'pending' && (
                          <button
                            onClick={() => removeEntry(idx)}
                            className="text-xs hover:opacity-70"
                            style={mutedStyle}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                      value={entry.description}
                      onChange={e => updateDesc(idx, e.target.value)}
                      placeholder="Brief description of this document *"
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                      style={{ background: 'var(--bg-page, #111)', border: '1px solid var(--border, #333)', color: 'var(--text-primary, #fff)' }}
                      disabled={entry.status !== 'pending'}
                    />
                  </div>
                ))}
              </div>
            )}

            {globalError && (
              <p className="text-sm rounded-lg px-3 py-2" style={{ background: '#3f1212', color: '#f87171' }}>
                {globalError}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => inputRef.current?.click()}
                className="flex-1 py-2.5 rounded-xl text-sm border transition-opacity hover:opacity-80"
                style={{ color: 'var(--text-muted, #888)', borderColor: 'var(--border, #333)' }}
              >
                Add more files
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: accentColor }}
              >
                {submitting ? 'Uploading…' : `Upload ${entries.length > 0 ? `${entries.length} document${entries.length > 1 ? 's' : ''}` : 'documents'}`}
              </button>
            </div>
          </div>
        )}

        {/* ── SUCCESS STEP ── */}
        {step === 'success' && (
          <div className="rounded-2xl border p-8 text-center space-y-4" style={surfaceStyle}>
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto text-2xl"
              style={{ background: `${accentColor}22`, color: accentColor }}
            >
              ✓
            </div>
            <h1 className="text-xl font-semibold" style={primaryStyle}>Documents uploaded successfully</h1>
            <p className="text-sm" style={mutedStyle}>
              Thank you — your documents have been received. Safe T Consultancy will review them and ensure
              everything is configured correctly before you go live.
            </p>
            {emailError && (
              <p className="text-xs mt-2 rounded px-3 py-2" style={{ background: '#3f1212', color: '#f87171' }}>
                Notification email failed: {emailError}
              </p>
            )}
          </div>
        )}

        <p className="text-center text-xs mt-6" style={mutedStyle}>
          Safe T Consultancy Ltd · Secure document portal
        </p>
      </div>
    </div>
  )
}
