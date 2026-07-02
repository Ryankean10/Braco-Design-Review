'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, ChevronDown, ChevronUp, AlertTriangle, Calendar, Clock } from 'lucide-react'

interface Programme {
  id: string
  revision: string
  programme_date: string
  file_path: string
  file_name: string
  notes: string | null
  uploaded_at: string
}

interface Props {
  siteId: string
  initialProgrammes: Programme[]
  signedUrls: Record<string, string>  // id -> signed URL
  canEdit: boolean
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

export default function ProgrammePanel({ siteId, initialProgrammes, signedUrls: initialUrls, canEdit }: Props) {
  const [programmes, setProgrammes] = useState<Programme[]>(initialProgrammes)
  const [urls, setUrls] = useState<Record<string, string>>(initialUrls)
  const [viewing, setViewing] = useState<string | null>(
    initialProgrammes.length > 0 ? initialProgrammes[0].id : null
  )
  const [showHistory, setShowHistory] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [revision, setRevision] = useState('')
  const [programmeDate, setProgrammeDate] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const latest = programmes[0]
  const staleDays = latest ? daysSince(latest.uploaded_at) : null
  const isStale = staleDays !== null && staleDays > 28

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

    // Fetch a signed URL for the new programme
    const urlRes = await fetch(`/api/construction/sites/${siteId}/programme/${newProg.id}/url`)
    let signedUrl = ''
    if (urlRes.ok) { const { url } = await urlRes.json(); signedUrl = url }

    setProgrammes(prev => [newProg, ...prev])
    setUrls(prev => ({ ...prev, [newProg.id]: signedUrl }))
    setViewing(newProg.id)
    setShowUpload(false)
    setRevision('')
    setProgrammeDate('')
    setNotes('')
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const viewingProg = programmes.find(p => p.id === viewing)
  const viewingUrl = viewing ? urls[viewing] : null

  return (
    <div id="programme" className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      {/* Header */}
      <div className="px-5 py-3 border-b flex items-center justify-between gap-3"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <Calendar size={15} style={{ color: 'var(--accent)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>P6 Construction Programme</p>
          {latest && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{
              background: isStale ? 'rgba(251,146,60,0.15)' : 'rgba(74,222,128,0.12)',
              color: isStale ? '#fb923c' : '#4ade80'
            }}>
              {latest.revision} · {fmtDate(latest.programme_date)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {programmes.length > 1 && (
            <button onClick={() => setShowHistory(h => !h)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded"
              style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)' }}>
              {showHistory ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
              {programmes.length - 1} previous
            </button>
          )}
          {canEdit && (
            <button onClick={() => setShowUpload(u => !u)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
              style={{ background: 'var(--accent)', color: '#000', fontWeight: 600 }}>
              <Upload size={12}/> Upload
            </button>
          )}
        </div>
      </div>

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
          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Upload Programme</p>
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

      {/* Revision history list */}
      {showHistory && programmes.length > 1 && (
        <div className="border-b" style={{ borderColor: 'var(--border)' }}>
          {programmes.slice(1).map(p => (
            <button key={p.id} onClick={() => { setViewing(p.id); setShowHistory(false) }}
              className="w-full flex items-center gap-3 px-5 py-2.5 text-left hover:opacity-80 transition-opacity border-b last:border-0"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
              <FileText size={13} style={{ color: 'var(--text-muted)' }}/>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{p.revision}</span>
                <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>{fmtDate(p.programme_date)}</span>
              </div>
              <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                <Clock size={10}/> {fmtDate(p.uploaded_at)}
              </span>
            </button>
          ))}
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
              className="ml-auto text-xs hover:opacity-80"
              style={{ color: 'var(--accent)' }}>
              Open in new tab ↗
            </a>
          </div>
          <iframe src={viewingUrl} className="w-full" style={{ height: '70vh', border: 'none', display: 'block' }}
            title={`Programme ${viewingProg.revision}`}/>
        </div>
      )}

      {/* Empty viewer state */}
      {viewingProg && !viewingUrl && (
        <div className="px-5 py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
          Unable to load programme PDF. Try opening in a new tab.
        </div>
      )}
    </div>
  )
}
