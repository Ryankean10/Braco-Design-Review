'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Cpu, FileText, CheckCircle, X } from 'lucide-react'
import type { PlantManual } from '@/lib/types'

interface Props {
  manuals: PlantManual[]
  plantId: string
  companyId: string
  canEdit: boolean
}

export default function PlantManualsTab({ manuals, plantId, companyId, canEdit }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState<string | null>(null)
  const [extractResult, setExtractResult] = useState<{ manualId: string; count: number } | null>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('plant_id', plantId)
    fd.append('company_id', companyId)
    const res = await fetch(`/api/plant/${plantId}/manuals`, { method: 'POST', body: fd })
    if (res.ok) router.refresh()
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleExtract(manualId: string) {
    setExtracting(manualId)
    setExtractResult(null)
    const res = await fetch(`/api/plant/${plantId}/extract-manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manual_id: manualId }),
    })
    if (res.ok) {
      const { count } = await res.json()
      setExtractResult({ manualId, count })
      router.refresh()
    }
    setExtracting(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Manuals & Documents</h3>
        {canEdit && (
          <div>
            <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleUpload} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
              style={{ background: 'var(--accent)' }}
            >
              <Upload size={13} />
              {uploading ? 'Uploading...' : 'Upload PDF'}
            </button>
          </div>
        )}
      </div>

      {manuals.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <FileText size={32} className="mx-auto" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No manuals uploaded yet</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Upload a PDF manual and use AI to extract maintenance schedules automatically</p>
        </div>
      ) : (
        <div className="space-y-3">
          {manuals.map(m => (
            <div key={m.id} className="rounded-xl border p-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <FileText size={20} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{m.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Uploaded {new Date(m.created_at).toLocaleDateString('en-GB')}
                      {m.file_size ? ` · ${(m.file_size / 1024 / 1024).toFixed(1)} MB` : ''}
                    </p>
                    {m.ai_processed && m.ai_processed_at && (
                      <div className="flex items-center gap-1 mt-1">
                        <CheckCircle size={11} style={{ color: '#22c55e' }} />
                        <p className="text-xs" style={{ color: '#22c55e' }}>
                          AI processed {new Date(m.ai_processed_at).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                    )}
                    {extractResult?.manualId === m.id && (
                      <p className="text-xs mt-1" style={{ color: '#22c55e' }}>
                        ✓ Extracted {extractResult.count} maintenance task{extractResult.count !== 1 ? 's' : ''} — check Maintenance tab
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {canEdit && (
                    <button
                      onClick={() => handleExtract(m.id)}
                      disabled={extracting === m.id}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border disabled:opacity-50"
                      style={{ borderColor: 'var(--accent)', color: 'var(--accent)', background: 'transparent' }}
                    >
                      <Cpu size={11} />
                      {extracting === m.id ? 'Analysing...' : m.ai_processed ? 'Re-extract' : 'AI Extract'}
                    </button>
                  )}
                </div>
              </div>

              {extracting === m.id && (
                <div className="mt-3 rounded-lg p-3 text-xs" style={{ background: 'rgba(108,114,245,0.08)', border: '1px solid rgba(108,114,245,0.2)' }}>
                  <div className="flex items-center gap-2" style={{ color: 'var(--accent)' }}>
                    <div className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    Reading manual and extracting service intervals and maintenance tasks...
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl p-4 text-xs" style={{ background: 'var(--bg-elevated)', borderRadius: 12 }}>
        <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>How AI extraction works</p>
        <p style={{ color: 'var(--text-muted)' }}>
          Upload the manufacturer's PDF manual. Click <strong style={{ color: 'var(--text-primary)' }}>AI Extract</strong> and Claude will read the document, identify all service intervals, inspection points, and maintenance tasks, then automatically populate the Maintenance Schedule tab with recurring tasks at the correct intervals.
        </p>
      </div>
    </div>
  )
}
