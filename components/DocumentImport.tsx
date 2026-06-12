'use client'

import { useState, useRef } from 'react'
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { DocType, Stage } from '@/lib/types'

interface ParsedRow {
  doc_no: string
  title: string
  rev: string
  type: DocType
  stage: Stage
  author: string
  status: string
  date: string
  valid: boolean
  error?: string
}

function inferType(docNo: string): DocType {
  const segments = docNo.split('-')
  // Look for type code segment (DR, RP, SP, CA, SH, PP, QT, etc.)
  for (const seg of segments) {
    if (seg === 'DR') return 'Drawing'
    if (seg === 'RP') return 'Report'
    if (seg === 'SP') return 'Specification'
    if (seg === 'CA') return 'Report'      // calculation → Report
    if (seg === 'SH') return 'Schedule'
    if (seg === 'PP') return 'Other'
    if (seg === 'QT') return 'Other'
  }
  return 'Other'
}

function inferStage(status: string): Stage {
  const s = status.toLowerCase()
  if (s.includes('construction') || s.includes('ifc') || s.includes('a5')) return 'Build & Install'
  if (s.includes('commission')) return 'Test & Commission'
  if (s.includes('handover') || s.includes('energis')) return 'Energise & Handover'
  if (s.includes('procure') || s.includes('tender')) return 'Procure'
  // S2/S3/S4 and most others → Design
  return 'Design'
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  // Parse header
  const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim())
  const col = (row: string[], name: string) => {
    const idx = header.findIndex(h => h.toLowerCase().includes(name.toLowerCase()))
    return idx >= 0 ? (row[idx] ?? '').replace(/"/g, '').trim() : ''
  }

  const rows: ParsedRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    // CSV parse respecting quoted fields
    const cells: string[] = []
    let inQuote = false
    let cell = ''
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote }
      else if (ch === ',' && !inQuote) { cells.push(cell.trim()); cell = '' }
      else { cell += ch }
    }
    cells.push(cell.trim())

    const docNo = col(cells, 'name')
    const title = col(cells, 'description')
    const rev = col(cells, 'revision') || '1'
    const status = col(cells, 'status')
    const author = col(cells, 'author')
    const date = col(cells, 'date')

    if (!docNo) continue

    rows.push({
      doc_no: docNo,
      title: title || docNo,
      rev,
      type: inferType(docNo),
      stage: inferStage(status),
      author,
      status,
      date,
      valid: true,
    })
  }

  return rows
}

interface Props {
  projectId: string
  onImported: (count: number) => void
  onClose: () => void
}

export default function DocumentImport({ projectId, onImported, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; errors: number } | null>(null)
  const [parseError, setParseError] = useState('')

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setParseError('')
    setRows([])
    setResult(null)

    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const parsed = parseCSV(text)
      if (!parsed.length) {
        setParseError('No rows found — check the file has a header row and data.')
        return
      }
      setRows(parsed)
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    setImporting(true)
    const supabase = createClient()

    const payload = rows.filter(r => r.valid).map(r => ({
      project_id: projectId,
      doc_no: r.doc_no,
      title: r.title,
      rev: r.rev,
      type: r.type,
      stage: r.stage,
      storage_path: null,
      file_name: '',
    }))

    const { data, error } = await supabase
      .from('documents')
      .insert(payload)
      .select()

    setImporting(false)

    if (error) {
      setParseError(error.message)
      return
    }

    setResult({ imported: data?.length ?? 0, errors: rows.length - (data?.length ?? 0) })
    onImported(data?.length ?? 0)
  }

  const fieldStyle = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  }

  const STAGES: Stage[] = ['Feasibility','Design','Procure','Build & Install','Test & Commission','Energise & Handover']
  const DOC_TYPES: DocType[] = ['Drawing','Specification','Report','Schedule','Certificate','Other']

  return (
    <div className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={16} style={{ color: 'var(--accent)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Import from CSV</h3>
        </div>
        <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Supports your document management platform export format. Columns used: <strong>Name</strong>, <strong>Description</strong>, <strong>Revision</strong>, <strong>Status</strong>, <strong>Author</strong>, <strong>Revision Date Modified</strong>.
        Type and stage are inferred automatically — you can adjust before importing.
      </p>

      {/* File picker */}
      {!rows.length && !result && (
        <div>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-opacity hover:opacity-80"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
          >
            <Upload size={14} />
            Select CSV file
          </button>
          {parseError && (
            <p className="text-sm mt-2 rounded-lg px-3 py-2" style={{ background: '#3f1212', color: '#f87171' }}>{parseError}</p>
          )}
        </div>
      )}

      {/* Preview table */}
      {rows.length > 0 && !result && (
        <>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {rows.length} rows parsed — review and adjust type/stage before importing.
          </p>
          <div className="rounded-lg border overflow-auto max-h-96" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-xs min-w-[700px]">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
                  {['Doc No.','Title','Rev','Type','Stage'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-3 py-1.5 font-mono" style={{ color: 'var(--accent)' }}>{row.doc_no}</td>
                    <td className="px-3 py-1.5 max-w-xs truncate" style={{ color: 'var(--text-primary)' }}>{row.title}</td>
                    <td className="px-3 py-1.5 font-mono" style={{ color: 'var(--text-muted)' }}>{row.rev}</td>
                    <td className="px-3 py-1.5">
                      <select
                        value={row.type}
                        onChange={e => setRows(prev => prev.map((r, j) => j === i ? { ...r, type: e.target.value as DocType } : r))}
                        className="rounded px-1.5 py-0.5 text-xs outline-none"
                        style={fieldStyle}
                      >
                        {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        value={row.stage}
                        onChange={e => setRows(prev => prev.map((r, j) => j === i ? { ...r, stage: e.target.value as Stage } : r))}
                        className="rounded px-1.5 py-0.5 text-xs outline-none"
                        style={fieldStyle}
                      >
                        {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {parseError && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ background: '#3f1212', color: '#f87171' }}>{parseError}</p>
          )}

          <div className="flex justify-end gap-3">
            <button onClick={onClose}
              className="text-sm px-4 py-2 rounded-lg border"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
              Cancel
            </button>
            <button onClick={handleImport} disabled={importing}
              className="text-sm px-4 py-2 rounded-lg font-medium text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}>
              {importing ? `Importing ${rows.length} rows…` : `Import ${rows.length} documents`}
            </button>
          </div>
        </>
      )}

      {/* Success */}
      {result && (
        <div className="flex items-center gap-3 rounded-lg px-4 py-3" style={{ background: '#052e16', border: '1px solid #166534' }}>
          <CheckCircle size={16} style={{ color: 'var(--success)' }} />
          <div>
            <p className="text-sm font-medium" style={{ color: '#86efac' }}>
              {result.imported} documents imported successfully
            </p>
            {result.errors > 0 && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{result.errors} rows skipped</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
