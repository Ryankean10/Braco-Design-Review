'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, X, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  standardId: string
  docStoragePath: string | null
  docFileName: string | null
  isAdmin: boolean
}

export default function StandardDocUpload({ standardId, docStoragePath: initPath, docFileName: initName, isAdmin }: Props) {
  const [storagePath, setStoragePath] = useState(initPath)
  const [fileName, setFileName] = useState(initName)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  async function handleUpload(file: File) {
    if (!file) return
    setUploading(true)
    setError('')

    const path = `standards/${standardId}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`

    if (storagePath) {
      await supabase.storage.from('documents').remove([storagePath])
    }

    const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: false })
    if (upErr) { setError(upErr.message); setUploading(false); return }

    const { error: dbErr } = await supabase.from('standards').update({
      doc_storage_path: path,
      doc_file_name: file.name,
      doc_file_size: file.size,
    }).eq('id', standardId)

    if (dbErr) { setError(dbErr.message); setUploading(false); return }

    setStoragePath(path)
    setFileName(file.name)
    setUploading(false)
  }

  async function handleRemove() {
    if (storagePath) await supabase.storage.from('documents').remove([storagePath])
    await supabase.from('standards').update({ doc_storage_path: null, doc_file_name: null, doc_file_size: null }).eq('id', standardId)
    setStoragePath(null)
    setFileName(null)
  }

  async function handleDownload() {
    if (!storagePath) return
    const { data } = await supabase.storage.from('documents').createSignedUrl(storagePath, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  if (!storagePath) {
    if (!isAdmin) return null
    return (
      <div className="mt-2">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          <Upload size={11} />
          {uploading ? 'Uploading…' : 'Attach standard document (PDF)'}
        </button>
        {error && <p className="text-[10px] mt-1" style={{ color: 'var(--critical)' }}>{error}</p>}
        <input ref={inputRef} type="file" accept=".pdf" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
      </div>
    )
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <FileText size={11} style={{ color: 'var(--accent)' }} />
      <span className="text-[10px] truncate max-w-[180px]" style={{ color: 'var(--text-muted)' }}>{fileName}</span>
      <button onClick={handleDownload} title="Download" style={{ color: 'var(--accent)' }}>
        <Download size={11} />
      </button>
      {isAdmin && (
        <>
          <button onClick={() => inputRef.current?.click()} title="Replace" style={{ color: 'var(--text-muted)' }}>
            <Upload size={11} />
          </button>
          <button onClick={handleRemove} title="Remove" style={{ color: 'var(--text-muted)' }}>
            <X size={11} />
          </button>
        </>
      )}
      <input ref={inputRef} type="file" accept=".pdf" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
    </div>
  )
}
