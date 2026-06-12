'use client'

import { useState, useRef } from 'react'
import { Upload, X, CheckCircle, AlertCircle, Link } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Document } from '@/lib/types'

interface FileMatch {
  file: File
  matched: Document | null
  manualId: string
}

function matchFileToDoc(file: File, docs: Document[]): Document | null {
  const name = file.name.toLowerCase().replace(/[\s_]/g, '-')
  // Try to find a doc whose doc_no appears in the filename
  for (const doc of docs) {
    const docNo = doc.doc_no.toLowerCase().replace(/[\s_]/g, '-')
    if (name.includes(docNo)) return doc
  }
  // Try partial match — last segment of doc_no (e.g. 070003)
  for (const doc of docs) {
    const parts = doc.doc_no.split('-')
    const last = parts[parts.length - 1].toLowerCase()
    if (last.length >= 4 && name.includes(last)) return doc
  }
  return null
}

interface Props {
  projectId: string
  documents: Document[]
  onDone: () => void
  onClose: () => void
}

export default function DocumentBulkAttach({ projectId, documents, onDone, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [matches, setMatches] = useState<FileMatch[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  // Only show docs that don't yet have a file attached
  const unattached = documents.filter(d => !d.storage_path && !d.file_name)
  const attached = documents.filter(d => d.storage_path || d.file_name)

  function handleFiles(files: FileList | null) {
    if (!files) return
    const arr = Array.from(files)
    const newMatches: FileMatch[] = arr.map(file => ({
      file,
      matched: matchFileToDoc(file, documents),
      manualId: '',
    }))
    setMatches(newMatches)
  }

  function setManual(idx: number, docId: string) {
    setMatches(prev => prev.map((m, i) => i === idx ? { ...m, manualId: docId, matched: documents.find(d => d.id === docId) ?? null } : m))
  }

  async function handleUpload() {
    setUploading(true)
    setErrors([])
    const supabase = createClient()
    const toUpload = matches.filter(m => m.matched)
    let done = 0
    const errs: string[] = []

    for (const m of toUpload) {
      const doc = m.matched!
      const ext = m.file.name.split('.').pop()
      const storagePath = `${projectId}/${Date.now()}-${doc.doc_no.replace(/\s+/g, '_')}-${doc.rev}.${ext}`

      const { error: storageErr } = await supabase.storage
        .from('documents')
        .upload(storagePath, m.file, { upsert: false })

      if (storageErr) {
        errs.push(`${m.file.name}: ${storageErr.message}`)
        continue
      }

      const { error: dbErr } = await supabase
        .from('documents')
        .update({ storage_path: storagePath, file_name: m.file.name, file_size: m.file.size, mime_type: m.file.type })
        .eq('id', doc.id)

      if (dbErr) {
        errs.push(`${m.file.name}: ${dbErr.message}`)
        continue
      }

      done++
      setProgress(Math.round((done / toUpload.length) * 100))
    }

    setErrors(errs)
    setUploading(false)
    setDone(true)
  }

  const matched = matches.filter(m => m.matched).length
  const unmatched = matches.filter(m => !m.matched).length

  const fieldStyle = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  }

  return (
    <div className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link size={16} style={{ color: 'var(--accent)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Bulk attach files</h3>
        </div>
        <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Drop all your PDFs and drawings at once. Files are matched to document rows by doc number found in the filename.
        Unmatched files can be assigned manually.
        {attached.length > 0 && ` ${attached.length} rows already have files attached.`}
      </p>

      {/* Drop zone */}
      {!matches.length && !done && (
        <div
          className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-opacity hover:opacity-80"
          style={{ borderColor: 'var(--border)' }}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
        >
          <Upload size={24} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Drop files here or click to browse</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>PDF, DWG, DXF, PNG, JPG, XLSX, DOCX</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.xlsx,.docx"
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
        </div>
      )}

      {/* Match preview */}
      {matches.length > 0 && !done && (
        <>
          <div className="flex gap-4 text-xs">
            <span style={{ color: 'var(--success)' }}>✓ {matched} matched</span>
            {unmatched > 0 && <span style={{ color: 'var(--major)' }}>⚠ {unmatched} unmatched</span>}
          </div>

          <div className="rounded-lg border overflow-auto max-h-80" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-xs min-w-[600px]">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
                  <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>File</th>
                  <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>Matched document</th>
                  <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, i) => (
                  <tr key={i} className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-3 py-2 font-mono max-w-[200px] truncate" style={{ color: 'var(--text-primary)' }}>
                      {m.file.name}
                    </td>
                    <td className="px-3 py-2">
                      {m.matched ? (
                        <span style={{ color: 'var(--accent)' }}>{m.matched.doc_no} — {m.matched.title.slice(0, 40)}</span>
                      ) : (
                        <select
                          value={m.manualId}
                          onChange={e => setManual(i, e.target.value)}
                          className="rounded px-1.5 py-0.5 text-xs outline-none w-full"
                          style={fieldStyle}
                        >
                          <option value="">— assign manually —</option>
                          {documents.map(d => (
                            <option key={d.id} value={d.id}>{d.doc_no} Rev {d.rev} — {d.title.slice(0, 40)}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {m.matched
                        ? <span style={{ color: 'var(--success)' }}>✓ Auto-matched</span>
                        : m.manualId
                          ? <span style={{ color: 'var(--minor)' }}>✓ Manual</span>
                          : <span style={{ color: 'var(--major)' }}>⚠ Unmatched — will skip</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {uploading && (
            <div>
              <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                <span>Uploading…</span><span>{progress}%</span>
              </div>
              <div className="w-full rounded-full h-1.5" style={{ background: 'var(--border)' }}>
                <div className="h-1.5 rounded-full transition-all" style={{ width: `${progress}%`, background: 'var(--accent)' }} />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button onClick={onClose}
              className="text-sm px-4 py-2 rounded-lg border"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || matched === 0}
              className="text-sm px-4 py-2 rounded-lg font-medium text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}
            >
              {uploading ? 'Uploading…' : `Attach ${matched} file${matched !== 1 ? 's' : ''}`}
            </button>
          </div>
        </>
      )}

      {/* Done */}
      {done && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg px-4 py-3" style={{ background: '#052e16', border: '1px solid #166534' }}>
            <CheckCircle size={16} style={{ color: 'var(--success)' }} />
            <p className="text-sm font-medium" style={{ color: '#86efac' }}>
              {matched} file{matched !== 1 ? 's' : ''} attached successfully
            </p>
          </div>
          {errors.length > 0 && (
            <div className="rounded-lg px-4 py-3 space-y-1" style={{ background: '#3f1212', border: '1px solid #7f1d1d' }}>
              <p className="text-xs font-medium" style={{ color: '#f87171' }}>Some files failed:</p>
              {errors.map((e, i) => <p key={i} className="text-xs" style={{ color: '#fca5a5' }}>{e}</p>)}
            </div>
          )}
          <div className="flex justify-end">
            <button onClick={onDone}
              className="text-sm px-4 py-2 rounded-lg font-medium text-white"
              style={{ background: 'var(--accent)' }}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
