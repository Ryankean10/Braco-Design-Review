'use client'

import { useState, useRef, useEffect } from 'react'
import { Camera, X, CheckCircle, Upload, Loader } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const TEST_TYPES = [
  { key: 'HV Electrical', label: 'HV Switching / SAT' },
  { key: 'LV Electrical', label: 'LV Electrical' },
  { key: 'Civils & Geotechnical', label: 'Plate Load / GI' },
  { key: 'FAT', label: 'FAT' },
  { key: 'SAT', label: 'SAT' },
  { key: 'Protection & Control', label: 'Protection & Control' },
  { key: 'Other', label: 'Other' },
]

const STATUSES = ['Pass', 'Conditional Pass', 'Fail', 'Awaiting Review']

interface Project { id: string; name: string }
interface Props { projects: Project[]; userId: string }

interface QueuedCapture {
  projectId: string
  testType: string
  title: string
  location: string
  actualDate: string
  resultSummary: string
  status: string
  notes: string
  images: string[] // base64
}

export default function CaptureForm({ projects, userId }: Props) {
  const [step, setStep] = useState<'project' | 'type' | 'capture' | 'results' | 'done'>('project')
  const [projectId, setProjectId] = useState('')
  const [projectName, setProjectName] = useState('')
  const [testType, setTestType] = useState('')
  const [images, setImages] = useState<{ preview: string; file: File }[]>([])
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [actualDate, setActualDate] = useState(new Date().toISOString().split('T')[0])
  const [resultSummary, setResultSummary] = useState('')
  const [status, setStatus] = useState('Pass')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const filtered = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  // Retry queued submissions on mount
  useEffect(() => {
    retryQueue()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function retryQueue() {
    try {
      const raw = localStorage.getItem('capture_queue')
      if (!raw) return
      const queue: QueuedCapture[] = JSON.parse(raw)
      if (!queue.length) return
      const remaining: QueuedCapture[] = []
      for (const item of queue) {
        try {
          await submitCapture(item)
        } catch {
          remaining.push(item)
        }
      }
      if (remaining.length === 0) {
        localStorage.removeItem('capture_queue')
      } else {
        localStorage.setItem('capture_queue', JSON.stringify(remaining))
      }
    } catch {
      // ignore
    }
  }

  async function submitCapture(capture: QueuedCapture) {
    const supabase = createClient()

    // Insert test record
    const { data: testRow, error: testErr } = await supabase
      .from('test_register')
      .insert({
        project_id: capture.projectId,
        category: capture.testType,
        title: capture.title,
        location: capture.location || null,
        actual_date: capture.actualDate,
        result_summary: capture.resultSummary || null,
        status: capture.status,
        notes: capture.notes || null,
        assigned_to: userId,
        created_by: userId,
      })
      .select('id')
      .single()

    if (testErr) throw testErr

    // Upload images (base64 → blob)
    for (let i = 0; i < capture.images.length; i++) {
      const base64 = capture.images[i]
      const res = await fetch(base64)
      const blob = await res.blob()
      const path = `test-results/${testRow.id}/${Date.now()}_${i}.jpg`
      const { error: uploadErr } = await supabase.storage.from('documents').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
      if (!uploadErr) {
        await supabase.from('test_documents').insert({
          test_id: testRow.id,
          storage_path: path,
          file_name: `capture_${i + 1}.jpg`,
          file_size: blob.size,
          doc_type: 'Result Sheet',
          uploaded_by: userId,
        })
      }
    }
  }

  async function handleSubmit() {
    if (!title.trim()) { setError('Title is required'); return }
    setSubmitting(true)
    setError('')

    const base64Images = await Promise.all(
      images.map(img => new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(img.file)
      }))
    )

    const capture: QueuedCapture = {
      projectId, testType, title: title.trim(), location: location.trim(),
      actualDate, resultSummary: resultSummary.trim(), status, notes: notes.trim(),
      images: base64Images,
    }

    try {
      await submitCapture(capture)
      setStep('done')
    } catch {
      // Queue for retry
      try {
        const raw = localStorage.getItem('capture_queue') ?? '[]'
        const queue: QueuedCapture[] = JSON.parse(raw)
        queue.push(capture)
        localStorage.setItem('capture_queue', JSON.stringify(queue))
        setError('Saved offline — will retry when connection is restored.')
      } catch {
        setError('Submission failed and could not be queued. Check your connection.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  function addImages(files: FileList | null) {
    if (!files) return
    const newImages = Array.from(files).slice(0, 6 - images.length).map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }))
    setImages(prev => [...prev, ...newImages].slice(0, 6))
  }

  const fieldStyle = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  }

  const bigBtn = 'w-full py-4 rounded-xl text-sm font-medium text-left px-4 border transition-colors'

  if (step === 'done') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <CheckCircle size={48} className="text-green-500" />
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Submitted</h2>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Test record saved for <strong>{projectName}</strong>.
        </p>
        <button
          onClick={() => {
            setStep('project'); setProjectId(''); setImages([]); setTitle(''); setResultSummary(''); setNotes(''); setStatus('Pass')
          }}
          className="px-5 py-2 rounded-lg text-sm font-medium text-white mt-2"
          style={{ background: 'var(--accent)' }}
        >
          Submit another
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div className="flex gap-2 items-center text-xs" style={{ color: 'var(--text-muted)' }}>
        {['Project', 'Test type', 'Photos', 'Results'].map((s, i) => {
          const stepKeys = ['project', 'type', 'capture', 'results']
          const cur = stepKeys.indexOf(step)
          return (
            <span key={s} className="flex items-center gap-1">
              {i > 0 && <span>›</span>}
              <span style={{ color: cur === i ? 'var(--accent)' : cur > i ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: cur === i ? 600 : undefined }}>{s}</span>
            </span>
          )
        })}
      </div>

      {step === 'project' && (
        <div className="space-y-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search project…"
            className="w-full rounded-xl px-4 py-3 text-base outline-none"
            style={fieldStyle}
            autoFocus
          />
          <div className="space-y-2">
            {filtered.map(p => (
              <button key={p.id} onClick={() => { setProjectId(p.id); setProjectName(p.name); setStep('type') }}
                className={bigBtn}
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                {p.name}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No projects found</p>
            )}
          </div>
        </div>
      )}

      {step === 'type' && (
        <div className="space-y-2">
          <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>Select test type</p>
          {TEST_TYPES.map(t => (
            <button key={t.key} onClick={() => { setTestType(t.key); setStep('capture') }}
              className={bigBtn}
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
              {t.label}
            </button>
          ))}
          <button onClick={() => setStep('project')} className="text-sm w-full text-center pt-2" style={{ color: 'var(--text-muted)' }}>← Back</button>
        </div>
      )}

      {step === 'capture' && (
        <div className="space-y-4">
          <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Add photos (up to 6)</p>
          <div className="grid grid-cols-3 gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                <img src={img.preview} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 rounded-full p-0.5"
                  style={{ background: 'rgba(0,0,0,0.6)' }}
                >
                  <X size={12} className="text-white" />
                </button>
              </div>
            ))}
            {images.length < 6 && (
              <button
                onClick={() => fileRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                <Camera size={22} />
                <span className="text-[10px]">Add photo</span>
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={e => addImages(e.target.files)}
          />
          <div className="flex gap-3">
            <button onClick={() => setStep('type')} className="flex-1 py-3 rounded-xl border text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>← Back</button>
            <button
              onClick={() => setStep('results')}
              className="flex-2 py-3 px-6 rounded-xl text-sm font-medium text-white"
              style={{ background: 'var(--accent)', flex: 2 }}
            >
              {images.length > 0 ? `Continue with ${images.length} photo${images.length !== 1 ? 's' : ''}` : 'Skip photos'}
            </button>
          </div>
        </div>
      )}

      {step === 'results' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required
              placeholder="e.g. IR test phase A-B-C"
              className="w-full rounded-xl px-4 py-3 text-base outline-none"
              style={fieldStyle} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Date</label>
              <input type="date" value={actualDate} onChange={e => setActualDate(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={fieldStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Result</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={fieldStyle}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Location / circuit ref</label>
            <input value={location} onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Bay 3, Cable SB-1"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={fieldStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Result summary</label>
            <textarea value={resultSummary} onChange={e => setResultSummary(e.target.value)} rows={2}
              placeholder="Key readings or pass criteria"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
              style={fieldStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Any additional observations"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
              style={fieldStyle} />
          </div>

          {error && (
            <p className="text-sm rounded-xl px-4 py-3" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>{error}</p>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep('capture')} className="flex-1 py-3.5 rounded-xl border text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>← Back</button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !title.trim()}
              className="flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-medium text-white disabled:opacity-60"
              style={{ background: 'var(--accent)', flex: 2 }}
            >
              {submitting ? <><Loader size={14} className="animate-spin" /> Submitting…</> : <><Upload size={14} /> Submit</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
