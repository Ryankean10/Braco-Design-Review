'use client'

import { useState, useRef } from 'react'
import { ChevronDown, ChevronRight, Upload, FileText, Download, X, Plus, Pencil, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export interface ComplianceDocument {
  id: string
  company_id: string
  title: string
  category: string
  description: string | null
  reference_number: string | null
  issuing_body: string | null
  issue_date: string | null
  expiry_date: string | null
  cost_amount: number | null
  cost_currency: string
  doc_storage_path: string | null
  doc_file_name: string | null
  doc_file_size: number | null
  created_at: string
}

interface Props {
  initialDocs: ComplianceDocument[]
  canEdit: boolean
  companyId: string
}

const CATEGORIES = ['Insurance', 'IR35', 'Certification', 'H&S Accreditation', 'Legal', 'Other'] as const

const categoryColour: Record<string, string> = {
  'Insurance':        '#1d4ed8',
  'IR35':             '#7c3aed',
  'Certification':    '#0891b2',
  'H&S Accreditation':'#065f46',
  'Legal':            '#b45309',
  'Other':            '#374151',
}

function expiryInfo(expiryDate: string | null): { status: 'none' | 'expired' | 'soon' | 'valid'; days: number | null } {
  if (!expiryDate) return { status: 'none', days: null }
  const days = Math.floor((new Date(expiryDate).getTime() - Date.now()) / 86400000)
  const status = days < 0 ? 'expired' : days < 30 ? 'soon' : 'valid'
  return { status, days }
}

function ExpiryBadge({ expiryDate }: { expiryDate: string | null }) {
  const { status, days } = expiryInfo(expiryDate)
  if (status === 'none') return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>No expiry set</span>
  if (status === 'expired') return <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white" style={{ background: '#dc2626' }}>Expired</span>
  if (status === 'soon') return <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white" style={{ background: '#d97706' }}>Expiring in {days}d</span>
  return <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white" style={{ background: '#166534' }}>Valid</span>
}

function formatCost(amount: number | null, currency: string): string {
  if (!amount) return ''
  const sym = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$'
  return `${sym}${Number(amount).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

interface FormState {
  title: string
  category: string
  description: string
  reference_number: string
  issuing_body: string
  issue_date: string
  expiry_date: string
  cost_amount: string
  cost_currency: string
}

const emptyForm = (): FormState => ({
  title: '', category: 'Other', description: '', reference_number: '',
  issuing_body: '', issue_date: '', expiry_date: '', cost_amount: '', cost_currency: 'GBP',
})

function docFromForm(f: FormState, companyId: string, userId: string): Omit<ComplianceDocument, 'id' | 'created_at' | 'doc_storage_path' | 'doc_file_name' | 'doc_file_size'> & { created_by: string } {
  return {
    company_id: companyId,
    title: f.title.trim(),
    category: f.category,
    description: f.description.trim() || null,
    reference_number: f.reference_number.trim() || null,
    issuing_body: f.issuing_body.trim() || null,
    issue_date: f.issue_date || null,
    expiry_date: f.expiry_date || null,
    cost_amount: f.cost_amount ? parseFloat(f.cost_amount) : null,
    cost_currency: f.cost_currency,
    created_by: userId,
  }
}

function ComplianceRow({
  doc, canEdit, onUpdate, onDelete,
}: {
  doc: ComplianceDocument
  canEdit: boolean
  onUpdate: (updated: ComplianceDocument) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<FormState>({
    title: doc.title,
    category: doc.category,
    description: doc.description ?? '',
    reference_number: doc.reference_number ?? '',
    issuing_body: doc.issuing_body ?? '',
    issue_date: doc.issue_date ?? '',
    expiry_date: doc.expiry_date ?? '',
    cost_amount: doc.cost_amount != null ? String(doc.cost_amount) : '',
    cost_currency: doc.cost_currency,
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  async function saveEdit() {
    if (!form.title.trim()) return
    setSaving(true)
    setErr('')
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      title: form.title.trim(),
      category: form.category,
      description: form.description.trim() || null,
      reference_number: form.reference_number.trim() || null,
      issuing_body: form.issuing_body.trim() || null,
      issue_date: form.issue_date || null,
      expiry_date: form.expiry_date || null,
      cost_amount: form.cost_amount ? parseFloat(form.cost_amount) : null,
      cost_currency: form.cost_currency,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('compliance_documents').update(payload).eq('id', doc.id)
    if (error) { setErr(error.message); setSaving(false); return }
    onUpdate({ ...doc, ...payload })
    setEditing(false)
    setSaving(false)
  }

  async function handleUpload(file: File) {
    setUploading(true)
    setErr('')
    const path = `compliance/${doc.company_id}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`
    if (doc.doc_storage_path) {
      await supabase.storage.from('documents').remove([doc.doc_storage_path])
    }
    const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: false })
    if (upErr) { setErr(upErr.message); setUploading(false); return }
    const { error: dbErr } = await supabase.from('compliance_documents').update({
      doc_storage_path: path, doc_file_name: file.name, doc_file_size: file.size, updated_at: new Date().toISOString(),
    }).eq('id', doc.id)
    if (dbErr) { setErr(dbErr.message); setUploading(false); return }
    onUpdate({ ...doc, doc_storage_path: path, doc_file_name: file.name, doc_file_size: file.size })
    setUploading(false)
  }

  async function handleRemoveDoc() {
    if (doc.doc_storage_path) await supabase.storage.from('documents').remove([doc.doc_storage_path])
    await supabase.from('compliance_documents').update({ doc_storage_path: null, doc_file_name: null, doc_file_size: null, updated_at: new Date().toISOString() }).eq('id', doc.id)
    onUpdate({ ...doc, doc_storage_path: null, doc_file_name: null, doc_file_size: null })
  }

  async function handleDownload() {
    if (!doc.doc_storage_path) return
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.doc_storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function handleDelete() {
    if (!confirm(`Delete "${doc.title}"?`)) return
    if (doc.doc_storage_path) await supabase.storage.from('documents').remove([doc.doc_storage_path])
    await supabase.from('compliance_documents').delete().eq('id', doc.id)
    onDelete(doc.id)
  }

  return (
    <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <button
        onClick={() => { setOpen(o => !o); setEditing(false) }}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:opacity-90 transition-opacity"
        style={{ background: 'var(--bg-surface)' }}
      >
        <span className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white" style={{ background: categoryColour[doc.category] ?? '#374151' }}>
              {doc.category}
            </span>
            <ExpiryBadge expiryDate={doc.expiry_date} />
            {doc.cost_amount != null && (
              <span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
                {formatCost(doc.cost_amount, doc.cost_currency)}
              </span>
            )}
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{doc.title}</p>
          {(doc.reference_number || doc.issuing_body) && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {[doc.reference_number, doc.issuing_body].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </button>

      {open && !editing && (
        <div className="px-4 pb-4 space-y-3" style={{ background: 'var(--bg-elevated)' }}>
          {doc.description && (
            <p className="text-xs pt-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{doc.description}</p>
          )}

          <div className="flex flex-wrap gap-4 text-xs pt-1" style={{ color: 'var(--text-muted)' }}>
            {doc.issue_date && <span>Issued: {new Date(doc.issue_date).toLocaleDateString('en-GB')}</span>}
            {doc.expiry_date && <span>Expires: {new Date(doc.expiry_date).toLocaleDateString('en-GB')}</span>}
            {doc.cost_amount != null && <span>Cost: {formatCost(doc.cost_amount, doc.cost_currency)}</span>}
          </div>

          {/* Document attachment */}
          <div className="flex items-center gap-2 flex-wrap">
            {doc.doc_storage_path ? (
              <>
                <FileText size={12} style={{ color: 'var(--accent)' }} />
                <span className="text-xs truncate max-w-[200px]" style={{ color: 'var(--text-muted)' }}>{doc.doc_file_name}</span>
                <button onClick={handleDownload} title="Download" style={{ color: 'var(--accent)' }}><Download size={12} /></button>
                {canEdit && (
                  <>
                    <button onClick={() => fileRef.current?.click()} title="Replace" style={{ color: 'var(--text-muted)' }}><Upload size={12} /></button>
                    <button onClick={handleRemoveDoc} title="Remove" style={{ color: 'var(--text-muted)' }}><X size={12} /></button>
                  </>
                )}
              </>
            ) : canEdit ? (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                <Upload size={11} />
                {uploading ? 'Uploading…' : 'Attach document'}
              </button>
            ) : null}
            <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
          </div>

          {err && <p className="text-xs" style={{ color: 'var(--critical)' }}>{err}</p>}

          {canEdit && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border hover:opacity-80"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                <Pencil size={11} /> Edit
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border hover:opacity-80"
                style={{ borderColor: '#7f1d1d', color: '#f87171' }}
              >
                <Trash2 size={11} /> Delete
              </button>
            </div>
          )}
        </div>
      )}

      {open && editing && (
        <div className="px-4 pb-4 pt-3 space-y-3" style={{ background: 'var(--bg-elevated)' }}>
          <ComplianceForm form={form} setForm={setForm} />
          {err && <p className="text-xs" style={{ color: 'var(--critical)' }}>{err}</p>}
          <div className="flex gap-2">
            <button
              onClick={saveEdit}
              disabled={saving || !form.title.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
              style={{ background: 'var(--accent)' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg text-xs border hover:opacity-80" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ComplianceForm({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value })

  const inputCls = "w-full rounded-lg px-3 py-1.5 text-xs outline-none"
  const inputStyle = { background: 'var(--bg-page)', border: '1px solid var(--border)', color: 'var(--text-primary)' }
  const labelCls = "text-xs font-medium block mb-0.5"
  const labelStyle = { color: 'var(--text-muted)' }

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <label className={labelCls} style={labelStyle}>Title *</label>
        <input className={inputCls} style={inputStyle} value={form.title} onChange={set('title')} placeholder="e.g. Public Liability Insurance" />
      </div>
      <div>
        <label className={labelCls} style={labelStyle}>Category</label>
        <select className={inputCls} style={inputStyle} value={form.category} onChange={set('category')}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls} style={labelStyle}>Reference number</label>
        <input className={inputCls} style={inputStyle} value={form.reference_number} onChange={set('reference_number')} placeholder="e.g. POL-2024-001" />
      </div>
      <div>
        <label className={labelCls} style={labelStyle}>Issuing body</label>
        <input className={inputCls} style={inputStyle} value={form.issuing_body} onChange={set('issuing_body')} placeholder="e.g. Aviva" />
      </div>
      <div>
        <label className={labelCls} style={labelStyle}>Issue date</label>
        <input type="date" className={inputCls} style={inputStyle} value={form.issue_date} onChange={set('issue_date')} />
      </div>
      <div>
        <label className={labelCls} style={labelStyle}>Expiry date</label>
        <input type="date" className={inputCls} style={inputStyle} value={form.expiry_date} onChange={set('expiry_date')} />
      </div>
      <div>
        <label className={labelCls} style={labelStyle}>Cost amount</label>
        <input type="number" step="0.01" className={inputCls} style={inputStyle} value={form.cost_amount} onChange={set('cost_amount')} placeholder="0.00" />
      </div>
      <div>
        <label className={labelCls} style={labelStyle}>Currency</label>
        <select className={inputCls} style={inputStyle} value={form.cost_currency} onChange={set('cost_currency')}>
          <option value="GBP">GBP £</option>
          <option value="EUR">EUR €</option>
          <option value="USD">USD $</option>
        </select>
      </div>
      <div className="col-span-2">
        <label className={labelCls} style={labelStyle}>Description</label>
        <textarea
          className={inputCls}
          style={{ ...inputStyle, resize: 'vertical' }}
          rows={3}
          value={form.description}
          onChange={set('description')}
          placeholder="Additional notes"
        />
      </div>
    </div>
  )
}

export default function ComplianceTab({ initialDocs, canEdit, companyId }: Props) {
  const [docs, setDocs] = useState(initialDocs)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const supabase = createClient()

  const filtered = docs.filter(d =>
    (!search || d.title.toLowerCase().includes(search.toLowerCase()) || (d.description ?? '').toLowerCase().includes(search.toLowerCase())) &&
    (!catFilter || d.category === catFilter)
  )

  async function handleAdd() {
    if (!form.title.trim()) return
    setSaving(true)
    setErr('')
    const { data: { user } } = await supabase.auth.getUser()
    const payload = docFromForm(form, companyId, user?.id ?? '')
    const { data, error } = await supabase.from('compliance_documents').insert(payload).select().single()
    if (error) { setErr(error.message); setSaving(false); return }
    setDocs(prev => [data as ComplianceDocument, ...prev])
    setForm(emptyForm())
    setAdding(false)
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search compliance documents…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 rounded-lg px-3 py-2 text-sm outline-none min-w-0"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {canEdit && (
          <button
            onClick={() => { setAdding(a => !a); setErr('') }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'var(--accent)' }}
          >
            <Plus size={14} />
            Add document
          </button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <div className="rounded-xl border p-4 space-y-3" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>New compliance document</p>
          <ComplianceForm form={form} setForm={setForm} />
          {err && <p className="text-xs" style={{ color: 'var(--critical)' }}>{err}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving || !form.title.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
              style={{ background: 'var(--accent)' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => { setAdding(false); setForm(emptyForm()); setErr('') }}
              className="px-3 py-1.5 rounded-lg text-xs border hover:opacity-80"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
            {docs.length === 0 ? 'No compliance documents yet' : 'No documents match the filter'}
          </p>
        ) : (
          filtered.map(doc => (
            <ComplianceRow
              key={doc.id}
              doc={doc}
              canEdit={canEdit}
              onUpdate={updated => setDocs(prev => prev.map(d => d.id === updated.id ? updated : d))}
              onDelete={id => setDocs(prev => prev.filter(d => d.id !== id))}
            />
          ))
        )}
      </div>
    </div>
  )
}
