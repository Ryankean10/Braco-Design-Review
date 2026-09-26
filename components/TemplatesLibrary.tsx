'use client'

import { useRef, useState } from 'react'
import {
  Plus, Download, Trash2, Upload, X, FileText, Globe, Pencil, Archive, ArchiveRestore,
  FilePlus2, History, ChevronDown, ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ReferenceTemplate, ReferenceTemplateRevision } from '@/lib/types'

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
const BUCKET = 'reference-templates'

interface Props {
  initial: ReferenceTemplate[]
  companyId: string | null
  canManage: boolean
  canDelete: boolean
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

type Panel = { id: string; kind: 'edit' | 'uprev' | 'history' } | null

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

function formatSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fileExt(name: string) {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toUpperCase() : 'FILE'
}

function storagePathFor(companyId: string | null, fileName: string) {
  return `${companyId ?? 'global'}/${crypto.randomUUID()}-${fileName.replace(/\s+/g, '_')}`
}

function sortTemplates(ts: ReferenceTemplate[]) {
  return [...ts].sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title))
}

/** Suggest the next revision: "P01"→"P02", "3"→"4", "1.2"→"1.3", "A"→"B", "Rev C"→"Rev D". */
function nextRevision(current: string | null) {
  const v = (current ?? '').trim()
  if (!v) return '1'
  const num = v.match(/^(.*?)(\d+)$/)
  if (num) {
    const [, prefix, digits] = num
    return prefix + String(Number(digits) + 1).padStart(digits.length, '0')
  }
  const letter = v.match(/^(.*?)([A-Ya-y])$/)
  if (letter) {
    const [, prefix, ch] = letter
    return prefix + String.fromCharCode(ch.charCodeAt(0) + 1)
  }
  return ''
}

function FilePicker({ file, onChange }: { file: File | null; onChange: (f: File | null) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border hover:opacity-80"
        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
      >
        <Upload size={12} /> {file ? 'Change file' : 'Choose file'}
      </button>
      {file && (
        <span className="text-xs truncate max-w-[240px]" style={{ color: 'var(--text-secondary)' }}>
          {file.name} · {formatSize(file.size)}
        </span>
      )}
      <input ref={ref} type="file" accept={ACCEPT} className="hidden"
        onChange={e => onChange(e.target.files?.[0] ?? null)} />
    </div>
  )
}

function FormActions({ saving, label, onCancel, onSave }: { saving: boolean; label: string; onCancel: () => void; onSave: () => void }) {
  return (
    <div className="flex justify-end gap-2">
      <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>Cancel</button>
      <button
        onClick={onSave}
        disabled={saving}
        className="text-xs px-3 py-1.5 rounded-lg font-medium text-white hover:opacity-90 disabled:opacity-50"
        style={{ background: 'var(--accent)' }}
      >
        {saving ? 'Saving…' : label}
      </button>
    </div>
  )
}

function IconButton({ title, onClick, children, accent }: { title: string; onClick: () => void; children: React.ReactNode; accent?: boolean }) {
  return (
    <button onClick={onClick} title={title} className="hover:opacity-80"
      style={{ color: accent ? 'var(--accent)' : 'var(--text-muted)' }}>
      {children}
    </button>
  )
}

export default function TemplatesLibrary({ initial, companyId, canManage, canDelete, isSuperAdmin }: Props) {
  const [templates, setTemplates] = useState(initial)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [file, setFile] = useState<File | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [editForm, setEditForm] = useState({ title: '', description: '', category: '', doc_ref: '' })
  const [uprev, setUprev] = useState<{ version: string; notes: string; file: File | null }>({ version: '', notes: '', file: null })
  const [revisions, setRevisions] = useState<Record<string, ReferenceTemplateRevision[]>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const canEdit = (t: ReferenceTemplate) =>
    isSuperAdmin || (canManage && t.company_id !== null && t.company_id === companyId)
  const canRemove = (t: ReferenceTemplate) =>
    isSuperAdmin || (canDelete && t.company_id !== null && t.company_id === companyId)

  const archivedCount = templates.filter(t => t.archived_at).length
  const q = search.toLowerCase()
  const filtered = templates.filter(t =>
    (showArchived ? !!t.archived_at : !t.archived_at) &&
    (!q ||
      t.title.toLowerCase().includes(q) ||
      (t.description ?? '').toLowerCase().includes(q) ||
      (t.doc_ref ?? '').toLowerCase().includes(q) ||
      t.file_name.toLowerCase().includes(q)) &&
    (!categoryFilter || t.category === categoryFilter)
  )

  const categories = Array.from(new Set([...CATEGORIES, ...templates.map(t => t.category)]))
  const usedCategories = categories.filter(c => templates.some(t => t.category === c))

  function replaceTemplate(updated: ReferenceTemplate) {
    setTemplates(ts => sortTemplates(ts.map(t => (t.id === updated.id ? updated : t))))
  }

  function closePanel() {
    setPanel(null)
    setError('')
  }

  function resetForm() {
    setForm(emptyForm)
    setFile(null)
    setError('')
    setShowForm(false)
  }

  // ── Create ────────────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!form.title.trim()) { setError('Title is required'); return }
    if (!file) { setError('Choose a file to upload'); return }

    const targetCompanyId = isSuperAdmin && form.platformWide ? null : companyId
    if (!isSuperAdmin && !targetCompanyId) { setError('No company context — cannot upload'); return }

    setSaving(true)
    setError('')

    const path = storagePathFor(targetCompanyId, file.name)
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
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
      updated_by: user?.id ?? null,
    }).select().single()

    if (dbErr) {
      await supabase.storage.from(BUCKET).remove([path])
      setError(dbErr.message)
      setSaving(false)
      return
    }

    setTemplates(ts => sortTemplates([...ts, data as ReferenceTemplate]))
    setSaving(false)
    resetForm()
  }

  // ── Edit details ──────────────────────────────────────────────────────────
  function openEdit(t: ReferenceTemplate) {
    setEditForm({ title: t.title, description: t.description ?? '', category: t.category, doc_ref: t.doc_ref ?? '' })
    setError('')
    setPanel({ id: t.id, kind: 'edit' })
  }

  async function handleEdit(t: ReferenceTemplate) {
    if (!editForm.title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error: dbErr } = await supabase.from('reference_templates').update({
      title: editForm.title.trim(),
      description: editForm.description.trim() || null,
      category: editForm.category,
      doc_ref: editForm.doc_ref.trim() || null,
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', t.id).select().single()
    setSaving(false)
    if (dbErr) { setError(dbErr.message); return }
    replaceTemplate(data as ReferenceTemplate)
    closePanel()
  }

  // ── Up-rev ────────────────────────────────────────────────────────────────
  function openUprev(t: ReferenceTemplate) {
    setUprev({ version: nextRevision(t.version), notes: '', file: null })
    setError('')
    setPanel({ id: t.id, kind: 'uprev' })
  }

  async function handleUprev(t: ReferenceTemplate) {
    if (!uprev.file) { setError('Choose the new revision file'); return }
    if (!uprev.version.trim()) { setError('Enter the new revision number'); return }
    if (uprev.version.trim() === (t.version ?? '')) { setError('New revision must differ from the current one'); return }

    setSaving(true)
    setError('')

    const path = storagePathFor(t.company_id, uprev.file.name)
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, uprev.file, { upsert: false })
    if (upErr) { setError(upErr.message); setSaving(false); return }

    const { data, error: rpcErr } = await supabase.rpc('up_rev_reference_template', {
      p_template_id: t.id,
      p_version: uprev.version.trim(),
      p_file_name: uprev.file.name,
      p_file_size: uprev.file.size,
      p_storage_path: path,
      p_revision_notes: uprev.notes.trim(),
    })

    if (rpcErr) {
      await supabase.storage.from(BUCKET).remove([path])
      setError(rpcErr.message)
      setSaving(false)
      return
    }

    replaceTemplate(data as ReferenceTemplate)
    // Drop cached history so it reloads with the superseded revision
    setRevisions(r => { const next = { ...r }; delete next[t.id]; return next })
    setSaving(false)
    closePanel()
  }

  // ── History ───────────────────────────────────────────────────────────────
  async function toggleHistory(t: ReferenceTemplate) {
    if (panel?.id === t.id && panel.kind === 'history') { closePanel(); return }
    setError('')
    setPanel({ id: t.id, kind: 'history' })
    if (revisions[t.id]) return
    const { data, error: dbErr } = await supabase
      .from('reference_template_revisions')
      .select('*')
      .eq('template_id', t.id)
      .order('superseded_at', { ascending: false })
    if (dbErr) { setError(dbErr.message); return }
    setRevisions(r => ({ ...r, [t.id]: (data ?? []) as ReferenceTemplateRevision[] }))
  }

  // ── Archive / restore / delete ────────────────────────────────────────────
  async function setArchived(t: ReferenceTemplate, archive: boolean) {
    if (archive && !confirm(`Archive "${t.title}"? It will be hidden from the library but can be restored.`)) return
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error: dbErr } = await supabase.from('reference_templates').update({
      archived_at: archive ? new Date().toISOString() : null,
      archived_by: archive ? user?.id ?? null : null,
    }).eq('id', t.id).select().single()
    if (dbErr) { setError(dbErr.message); return }
    replaceTemplate(data as ReferenceTemplate)
    if (panel?.id === t.id) closePanel()
  }

  async function handleDelete(t: ReferenceTemplate) {
    if (!confirm(`Permanently delete "${t.title}" and all its revisions? This cannot be undone.`)) return
    setError('')
    const { data: revs } = await supabase.from('reference_template_revisions').select('storage_path').eq('template_id', t.id)
    const { error: dbErr } = await supabase.from('reference_templates').delete().eq('id', t.id)
    if (dbErr) { setError(dbErr.message); return }
    await supabase.storage.from(BUCKET).remove([t.storage_path, ...(revs ?? []).map(r => r.storage_path)])
    setTemplates(ts => ts.filter(x => x.id !== t.id))
  }

  async function download(storagePath: string, fileName: string) {
    const { data, error: urlErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 60, { download: fileName })
    if (urlErr) { setError(urlErr.message); return }
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  return (
    <div className="space-y-3">
      {/* Search + filter + add */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search templates…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[180px] rounded-lg px-3 py-2 text-sm outline-none"
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
        <button
          onClick={() => { setShowArchived(s => !s); closePanel() }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border hover:opacity-80"
          style={showArchived
            ? { borderColor: 'var(--accent)', color: 'var(--accent)' }
            : { borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          <Archive size={13} /> {showArchived ? 'Showing archived' : 'Archived'} ({archivedCount})
        </button>
        {canManage && !showForm && !showArchived && (
          <button
            onClick={() => { setShowForm(true); closePanel() }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            <Plus size={13} /> Add template
          </button>
        )}
      </div>

      {error && !showForm && !panel && <p className="text-xs" style={{ color: 'var(--critical)' }}>{error}</p>}

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
            <input style={field} placeholder="Revision, e.g. P01 or A (optional)" value={form.version}
              onChange={e => setForm(f => ({ ...f, version: e.target.value }))} />
          </div>
          <textarea style={{ ...field, minHeight: '4rem' }} placeholder="Description — what it's for and when to use it (optional)"
            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <div className="flex flex-wrap items-center gap-3">
            <FilePicker file={file} onChange={setFile} />
            {isSuperAdmin && (
              <label className="flex items-center gap-1.5 text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
                <input type="checkbox" checked={form.platformWide}
                  onChange={e => setForm(f => ({ ...f, platformWide: e.target.checked }))} />
                Platform-wide (all companies)
              </label>
            )}
          </div>
          {error && <p className="text-xs" style={{ color: 'var(--critical)' }}>{error}</p>}
          <FormActions saving={saving} label="Save template" onCancel={resetForm} onSave={handleCreate} />
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
          {showArchived ? 'No archived templates' : templates.length === 0 ? 'No templates yet' : 'No templates found'}
        </p>
      ) : (
        filtered.map(t => {
          const active = panel?.id === t.id ? panel.kind : null
          const archived = !!t.archived_at
          return (
            <div key={t.id} className="border rounded-xl overflow-hidden"
              style={{ borderColor: 'var(--border)', opacity: archived ? 0.75 : 1 }}>
              <div className="px-4 py-3 flex items-start gap-3" style={{ background: 'var(--bg-surface)' }}>
                <div className="flex-shrink-0 w-9 h-9 rounded-lg flex flex-col items-center justify-center"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--accent)' }}>
                  <FileText size={14} />
                  <span className="text-[8px] font-semibold leading-none mt-0.5">{fileExt(t.file_name)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {t.doc_ref && <span className="text-xs font-mono font-semibold" style={{ color: 'var(--accent)' }}>{t.doc_ref}</span>}
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white" style={{ background: '#374151' }}>{t.category}</span>
                    {t.version && (
                      <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                        Rev {t.version}
                      </span>
                    )}
                    {t.company_id === null && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <Globe size={11} /> Platform
                      </span>
                    )}
                    {archived && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white" style={{ background: '#854d0e' }}>
                        Archived {formatDate(t.archived_at!)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{t.title}</p>
                  {t.description && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{t.description}</p>
                  )}
                  {t.revision_notes && (
                    <p className="text-[10px] mt-0.5 italic" style={{ color: 'var(--text-muted)' }}>Rev notes: {t.revision_notes}</p>
                  )}
                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                    {t.file_name}{t.file_size ? ` · ${formatSize(t.file_size)}` : ''} · Updated {formatDate(t.updated_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <IconButton title="Download current revision" accent onClick={() => download(t.storage_path, t.file_name)}>
                    <Download size={14} />
                  </IconButton>
                  <IconButton title="Revision history" onClick={() => toggleHistory(t)}>
                    <History size={14} />
                  </IconButton>
                  {canEdit(t) && !archived && (
                    <>
                      <IconButton title="Edit details" onClick={() => active === 'edit' ? closePanel() : openEdit(t)}>
                        <Pencil size={14} />
                      </IconButton>
                      <IconButton title="Up-rev (upload new revision)" onClick={() => active === 'uprev' ? closePanel() : openUprev(t)}>
                        <FilePlus2 size={14} />
                      </IconButton>
                      <IconButton title="Archive" onClick={() => setArchived(t, true)}>
                        <Archive size={14} />
                      </IconButton>
                    </>
                  )}
                  {canEdit(t) && archived && (
                    <IconButton title="Restore" onClick={() => setArchived(t, false)}>
                      <ArchiveRestore size={14} />
                    </IconButton>
                  )}
                  {canRemove(t) && (
                    <IconButton title="Delete permanently" onClick={() => handleDelete(t)}>
                      <Trash2 size={14} />
                    </IconButton>
                  )}
                </div>
              </div>

              {/* Edit panel */}
              {active === 'edit' && (
                <div className="px-4 py-3 space-y-3 border-t" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Edit details</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input style={field} placeholder="Title *" value={editForm.title}
                      onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
                    <select style={field} value={editForm.category}
                      onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input style={field} placeholder="Document reference" value={editForm.doc_ref}
                      onChange={e => setEditForm(f => ({ ...f, doc_ref: e.target.value }))} />
                  </div>
                  <textarea style={{ ...field, minHeight: '3.5rem' }} placeholder="Description" value={editForm.description}
                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    To change the file or revision number, use Up-rev so the current revision is kept in the history.
                  </p>
                  {error && <p className="text-xs" style={{ color: 'var(--critical)' }}>{error}</p>}
                  <FormActions saving={saving} label="Save changes" onCancel={closePanel} onSave={() => handleEdit(t)} />
                </div>
              )}

              {/* Up-rev panel */}
              {active === 'uprev' && (
                <div className="px-4 py-3 space-y-3 border-t" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Up-rev {t.version ? `from Rev ${t.version}` : ''}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input style={field} placeholder="New revision *" value={uprev.version}
                      onChange={e => setUprev(u => ({ ...u, version: e.target.value }))} />
                    <input style={{ ...field, gridColumn: 'span 2' }} placeholder="What changed in this revision (optional)" value={uprev.notes}
                      onChange={e => setUprev(u => ({ ...u, notes: e.target.value }))} />
                  </div>
                  <FilePicker file={uprev.file} onChange={f => setUprev(u => ({ ...u, file: f }))} />
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    The current file{t.version ? ` (Rev ${t.version})` : ''} will be superseded and kept in the revision history.
                  </p>
                  {error && <p className="text-xs" style={{ color: 'var(--critical)' }}>{error}</p>}
                  <FormActions saving={saving} label="Issue new revision" onCancel={closePanel} onSave={() => handleUprev(t)} />
                </div>
              )}

              {/* History panel */}
              {active === 'history' && (
                <div className="px-4 py-3 space-y-2 border-t" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Revision history</p>
                  <div className="flex items-center gap-2 text-xs">
                    <ChevronRight size={12} style={{ color: 'var(--accent)' }} />
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{t.version ? `Rev ${t.version}` : 'Current'}</span>
                    <span style={{ color: 'var(--text-muted)' }}>· current · {formatDate(t.updated_at)}</span>
                  </div>
                  {!revisions[t.id] && !error && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading…</p>}
                  {revisions[t.id]?.length === 0 && (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No earlier revisions</p>
                  )}
                  {revisions[t.id]?.map(r => (
                    <div key={r.id} className="flex items-start gap-2 text-xs">
                      <ChevronDown size={12} className="mt-0.5" style={{ color: 'var(--text-muted)' }} />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{r.version ? `Rev ${r.version}` : 'Unversioned'}</span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {' '}· issued {formatDate(r.uploaded_at)} · superseded {formatDate(r.superseded_at)} · {r.file_name}
                        </span>
                        {r.revision_notes && (
                          <p className="text-[10px] italic" style={{ color: 'var(--text-muted)' }}>{r.revision_notes}</p>
                        )}
                      </div>
                      <IconButton title="Download this revision" onClick={() => download(r.storage_path, r.file_name)}>
                        <Download size={12} />
                      </IconButton>
                    </div>
                  ))}
                  {error && <p className="text-xs" style={{ color: 'var(--critical)' }}>{error}</p>}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
