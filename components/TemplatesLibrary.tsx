'use client'

import { useRef, useState } from 'react'
import { Plus, Download, Trash2, Upload, X, FileText, Globe } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ReferenceTemplate } from '@/lib/types'

const CATEGORIES = [
  'Admin & Forms',
  'Registers & Logs',
  'Letters & Correspondence',
  'Checklists',
  'H&S / RAMS',
  'Commercial',
  'Technical',
  'Quality',
  'HR',
  'Other',
]

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.xlsm,.ppt,.pptx,.csv,.txt,.dotx,.xltx'

interface Props {
  initial: ReferenceTemplate[]
  companyId: string | null
  isAdmin: boolean
  isSuperAdmin: boolean
}

const emptyForm = {
  title: '',
  description: '',
  category: 'Admin & Forms',
  doc_ref: '',
  version: '',
  platformWide: false,
}

function formatSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileExt(name: string) {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toUpperCase() : 'FILE'
}

export default function TemplatesLibrary({ initial, companyId, isAdmin, isSuperAdmin }: Props) {
  const [templates, setTemplates] = useState(initial)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const canManage = (t: ReferenceTemplate) =>
    isSuperAdmin || (isAdmin && t.company_id !== null && t.company_id === companyId)

  const q = search.toLowerCase()
  const filtered = templates.filter(t =>
    (!q ||
      t.title.toLowerCase().includes(q) ||
      (t.description ?? '').toLowerCase().includes(q) ||
      (t.doc_ref ?? '').toLowerCase().includes(q) ||
      t.file_name.toLowerCase().includes(q)) &&
    (!categoryFilter || t.category === categoryFilter)
  )

  const categories = Array.from(new Set([...CATEGORIES, ...templates.map(t => t.category)]))
  const usedCategories = categories.filter(c => templates.some(t => t.category === c))

  function resetForm() {
    setForm(emptyForm)
    setFile(null)
    setError('')
    setShowForm(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleSave() {
    if (!form.title.trim()) { setError('Title is required'); return }
    if (!file) { setError('Choose a file to upload'); return }

    const targetCompanyId = isSuperAdmin && form.platformWide ? null : companyId
    if (!isSuperAdmin && !targetCompanyId) { setError('No company context — cannot upload'); return }

    setSaving(true)
    setError('')

    const folder = targetCompanyId ?? 'global'
    const path = `${folder}/${crypto.randomUUID()}-${file.name.replace(/\s+/g, '_')}`

    const { error: upErr } = await supabase.storage.from('reference-templates').upload(path, file, { upsert: false })
    if (upErr) { setError(upErr.message); setSaving(false); return }

    const { data: { user } } = await supabase.auth.getUser()
    const { data, error: dbErr } = await supabase.from('reference_templates').insert({
      company_id: targetCompanyId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
      doc_ref: form.doc_ref.trim() || null,
      version: form.version.trim() || null,
      file_name: file.name,
      file_size: file.size,
      storage_path: path,
      created_by: user?.id ?? null,
    }).select().single()

    if (dbErr) {
      await supabase.storage.from('reference-templates').remove([path])
      setError(dbErr.message)
      setSaving(false)
      return
    }

    setTemplates(ts => [...ts, data as ReferenceTemplate].sort((a, b) =>
      a.category.localeCompare(b.category) || a.title.localeCompare(b.title)))
    setSaving(false)
    resetForm()
  }

  async function handleDownload(t: ReferenceTemplate) {
    const { data, error: urlErr } = await supabase.storage
      .from('reference-templates')
      .createSignedUrl(t.storage_path, 60, { download: t.file_name })
    if (urlErr) { setError(urlErr.message); return }
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function handleDelete(t: ReferenceTemplate) {
    if (!confirm(`Delete template "${t.title}"? This cannot be undone.`)) return
    const { error: dbErr } = await supabase.from('reference_templates').delete().eq('id', t.id)
    if (dbErr) { setError(dbErr.message); return }
    await supabase.storage.from('reference-templates').remove([t.storage_path])
    setTemplates(ts => ts.filter(x => x.id !== t.id))
  }

  const field = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    borderRadius: '0.5rem',
    padding: '0.5rem 0.75rem',
    fontSize: '0.75rem',
    width: '100%',
    outline: 'none',
  } as React.CSSProperties

  return (
    <div className="space-y-3">
      {/* Search + filter + add */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search templates…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          <option value="">All categories</option>
          {usedCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {isAdmin && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            <Plus size={13} /> Add template
          </button>
        )}
      </div>

      {error && !showForm && <p className="text-xs" style={{ color: 'var(--critical)' }}>{error}</p>}

      {/* Add form */}
      {showForm && (
        <div className="border rounded-xl p-4 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>New template</p>
            <button onClick={resetForm} style={{ color: 'var(--text-muted)' }}><X size={14} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input style={field} placeholder="Title *" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <select style={field} value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input style={field} placeholder="Document reference (optional)" value={form.doc_ref}
              onChange={e => setForm(f => ({ ...f, doc_ref: e.target.value }))} />
            <input style={field} placeholder="Version / revision (optional)" value={form.version}
              onChange={e => setForm(f => ({ ...f, version: e.target.value }))} />
          </div>
          <textarea style={{ ...field, minHeight: '4rem' }} placeholder="Description — what it's for and when to use it (optional)"
            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border hover:opacity-80"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              <Upload size={12} /> {file ? 'Change file' : 'Choose file'}
            </button>
            {file && <span className="text-xs truncate max-w-[240px]" style={{ color: 'var(--text-secondary)' }}>{file.name} · {formatSize(file.size)}</span>}
            <input ref={inputRef} type="file" accept={ACCEPT} className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)} />
            {isSuperAdmin && (
              <label className="flex items-center gap-1.5 text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
                <input type="checkbox" checked={form.platformWide}
                  onChange={e => setForm(f => ({ ...f, platformWide: e.target.checked }))} />
                Platform-wide (all companies)
              </label>
            )}
          </div>
          {error && <p className="text-xs" style={{ color: 'var(--critical)' }}>{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={resetForm} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs px-3 py-1.5 rounded-lg font-medium text-white hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--accent)' }}
            >
              {saving ? 'Uploading…' : 'Save template'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
          {templates.length === 0 ? 'No templates yet' : 'No templates found'}
        </p>
      ) : (
        filtered.map(t => (
          <div key={t.id} className="border rounded-xl px-4 py-3 flex items-start gap-3"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
            <div className="flex-shrink-0 w-9 h-9 rounded-lg flex flex-col items-center justify-center"
              style={{ background: 'var(--bg-elevated)', color: 'var(--accent)' }}>
              <FileText size={14} />
              <span className="text-[8px] font-semibold leading-none mt-0.5">{fileExt(t.file_name)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {t.doc_ref && <span className="text-xs font-mono font-semibold" style={{ color: 'var(--accent)' }}>{t.doc_ref}</span>}
                <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white" style={{ background: '#374151' }}>{t.category}</span>
                {t.version && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Rev {t.version}</span>}
                {t.company_id === null && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <Globe size={11} /> Platform
                  </span>
                )}
              </div>
              <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{t.title}</p>
              {t.description && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{t.description}</p>
              )}
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                {t.file_name}{t.file_size ? ` · ${formatSize(t.file_size)}` : ''} · Updated{' '}
                {new Date(t.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => handleDownload(t)} title="Download" className="hover:opacity-80" style={{ color: 'var(--accent)' }}>
                <Download size={14} />
              </button>
              {canManage(t) && (
                <button onClick={() => handleDelete(t)} title="Delete" className="hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
