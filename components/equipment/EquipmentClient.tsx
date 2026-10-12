'use client'

import { useState, useRef } from 'react'
import { Plus, Pencil, Trash2, X, Check, ChevronDown, Upload, Download, FileX, Wrench } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = ['Test Equipment', 'Safety Equipment', 'Survey Equipment', 'Tool', 'Vehicle', 'Other'] as const
const OWNERSHIPS = ['Owned', 'Hired'] as const

export interface EquipmentItem {
  id: string
  company_id: string
  name: string
  asset_ref: string | null
  serial_number: string | null
  manufacturer: string | null
  model: string | null
  category: string
  ownership: string
  hire_company: string | null
  hire_return_date: string | null
  calibration_date: string | null
  calibration_expiry: string | null
  cert_storage_path: string | null
  cert_file_name: string | null
  cert_file_size: number | null
  notes: string | null
  created_at: string
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

function expiryInfo(expiry: string | null): { status: 'none' | 'expired' | 'soon' | 'valid'; days: number | null } {
  if (!expiry) return { status: 'none', days: null }
  const days = Math.floor((new Date(expiry).getTime() - Date.now()) / 86400000)
  return {
    status: days < 0 ? 'expired' : days < 30 ? 'soon' : 'valid',
    days,
  }
}

function ExpiryBadge({ expiry }: { expiry: string | null }) {
  const { status, days } = expiryInfo(expiry)
  if (status === 'none') return <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>No calibration</span>
  if (status === 'expired') return <span className="text-[10px] px-1.5 py-0.5 rounded font-medium text-white" style={{ background: 'var(--critical)' }}>Expired</span>
  if (status === 'soon') return <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>Expires in {days}d</span>
  return <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>Valid</span>
}

const emptyForm = {
  name: '',
  asset_ref: '',
  serial_number: '',
  manufacturer: '',
  model: '',
  category: 'Test Equipment' as string,
  ownership: 'Owned' as string,
  hire_company: '',
  hire_return_date: '',
  calibration_date: '',
  calibration_expiry: '',
  override_expiry: false,
  notes: '',
}
type FormState = typeof emptyForm

function field(extra?: React.CSSProperties): React.CSSProperties {
  return {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    borderRadius: '0.5rem',
    padding: '0.5rem 0.75rem',
    fontSize: '0.75rem',
    width: '100%',
    outline: 'none',
    ...extra,
  }
}

function EquipmentForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: FormState
  onSave: (f: FormState) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState(initial)
  const set = (k: keyof FormState, v: any) => setForm(f => ({ ...f, [k]: v }))

  // Auto-fill expiry when calibration_date changes and not overriding
  function onCalibrationDate(v: string) {
    set('calibration_date', v)
    if (!form.override_expiry && v) {
      set('calibration_expiry', addMonths(v, 12))
    }
  }

  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ background: 'var(--bg-surface)', borderColor: 'var(--accent)' }}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Name *</label>
          <input style={field()} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Megger MIT430 Insulation Tester" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Category</label>
          <select style={field()} value={form.category} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Ownership</label>
          <select style={field()} value={form.ownership} onChange={e => set('ownership', e.target.value)}>
            {OWNERSHIPS.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Asset Ref / ID</label>
          <input style={field()} value={form.asset_ref} onChange={e => set('asset_ref', e.target.value)} placeholder="e.g. BP-TE-001" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Serial Number</label>
          <input style={field()} value={form.serial_number} onChange={e => set('serial_number', e.target.value)} placeholder="Manufacturer serial" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Manufacturer</label>
          <input style={field()} value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} placeholder="e.g. Megger" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Model</label>
          <input style={field()} value={form.model} onChange={e => set('model', e.target.value)} placeholder="e.g. MIT430-2" />
        </div>
        {form.ownership === 'Hired' && (
          <>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Hire Company</label>
              <input style={field()} value={form.hire_company} onChange={e => set('hire_company', e.target.value)} placeholder="e.g. HSS Hire" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Return Date</label>
              <input type="date" style={field()} value={form.hire_return_date} onChange={e => set('hire_return_date', e.target.value)} />
            </div>
          </>
        )}
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Calibration Date</label>
          <input type="date" style={field()} value={form.calibration_date} onChange={e => onCalibrationDate(e.target.value)} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Calibration Expiry</label>
            <label className="flex items-center gap-1 text-[10px] cursor-pointer" style={{ color: 'var(--text-muted)' }}>
              <input
                type="checkbox"
                checked={form.override_expiry}
                onChange={e => {
                  set('override_expiry', e.target.checked)
                  if (!e.target.checked && form.calibration_date) {
                    set('calibration_expiry', addMonths(form.calibration_date, 12))
                  }
                }}
              />
              Override (cert states different period)
            </label>
          </div>
          <input
            type="date"
            style={field({ opacity: !form.override_expiry && !form.calibration_expiry ? 0.5 : 1 })}
            value={form.calibration_expiry}
            onChange={e => set('calibration_expiry', e.target.value)}
            readOnly={!form.override_expiry && !form.calibration_date}
          />
          {!form.override_expiry && form.calibration_date && (
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Auto-set to 12 months from calibration date</p>
          )}
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Notes</label>
          <textarea style={{ ...field(), minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Location, condition, usage notes…" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border"
          style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
          <X size={12} /> Cancel
        </button>
        <button type="button"
          onClick={() => form.name.trim() && onSave(form)}
          disabled={saving || !form.name.trim()}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium text-white disabled:opacity-50"
          style={{ background: 'var(--accent)' }}>
          <Check size={12} /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function EquipmentRow({
  item,
  canEdit,
  onEdit,
  onDelete,
  onUpdate,
}: {
  item: EquipmentItem
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
  onUpdate: (updated: EquipmentItem) => void
}) {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function handleUpload(file: File) {
    setUploading(true)
    const path = `equipment/${item.company_id}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`
    if (item.cert_storage_path) {
      await supabase.storage.from('documents').remove([item.cert_storage_path])
    }
    const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: false })
    if (!error) {
      await supabase.from('equipment_items').update({
        cert_storage_path: path,
        cert_file_name: file.name,
        cert_file_size: file.size,
        updated_at: new Date().toISOString(),
      }).eq('id', item.id)
      onUpdate({ ...item, cert_storage_path: path, cert_file_name: file.name, cert_file_size: file.size })
    }
    setUploading(false)
  }

  async function handleDownload() {
    if (!item.cert_storage_path) return
    const { data } = await supabase.storage.from('documents').createSignedUrl(item.cert_storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function handleRemoveCert() {
    if (!item.cert_storage_path) return
    await supabase.storage.from('documents').remove([item.cert_storage_path])
    await supabase.from('equipment_items').update({
      cert_storage_path: null,
      cert_file_name: null,
      cert_file_size: null,
      updated_at: new Date().toISOString(),
    }).eq('id', item.id)
    onUpdate({ ...item, cert_storage_path: null, cert_file_name: null, cert_file_size: null })
  }

  const { status } = expiryInfo(item.calibration_expiry)

  return (
    <>
      <tr
        className="border-t cursor-pointer hover:opacity-90 transition-opacity"
        style={{ borderColor: 'var(--border)', background: expanded ? 'var(--bg-elevated)' : 'var(--bg-surface)' }}
        onClick={() => setExpanded(e => !e)}
      >
        <td className="px-4 py-3">
          <ExpiryBadge expiry={item.calibration_expiry} />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <ChevronDown size={11} className="flex-shrink-0 transition-transform"
              style={{ color: 'var(--text-muted)', transform: expanded ? 'rotate(180deg)' : 'rotate(-90deg)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
          </div>
        </td>
        <td className="px-4 py-3 hidden md:table-cell">
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
            {item.category}
          </span>
        </td>
        <td className="px-4 py-3 hidden lg:table-cell text-xs" style={{ color: 'var(--text-muted)' }}>
          {item.ownership === 'Hired' ? `Hired — ${item.hire_company ?? ''}` : 'Owned'}
        </td>
        <td className="px-4 py-3 hidden lg:table-cell text-xs" style={{ color: 'var(--text-muted)' }}>
          {item.asset_ref ?? item.serial_number ?? '—'}
        </td>
        {canEdit && (
          <td className="px-4 py-3">
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <button onClick={onEdit} style={{ color: 'var(--text-muted)' }}><Pencil size={12} /></button>
              <button onClick={onDelete} style={{ color: 'var(--critical)' }}><Trash2 size={12} /></button>
            </div>
          </td>
        )}
      </tr>
      {expanded && (
        <tr style={{ background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)' }}>
          <td colSpan={canEdit ? 6 : 5} className="px-6 py-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-xs mb-3">
              {item.manufacturer && <div><span style={{ color: 'var(--text-muted)' }}>Manufacturer: </span><span style={{ color: 'var(--text-primary)' }}>{item.manufacturer}</span></div>}
              {item.model && <div><span style={{ color: 'var(--text-muted)' }}>Model: </span><span style={{ color: 'var(--text-primary)' }}>{item.model}</span></div>}
              {item.serial_number && <div><span style={{ color: 'var(--text-muted)' }}>Serial: </span><span style={{ color: 'var(--text-primary)' }}>{item.serial_number}</span></div>}
              {item.asset_ref && <div><span style={{ color: 'var(--text-muted)' }}>Asset Ref: </span><span style={{ color: 'var(--text-primary)' }}>{item.asset_ref}</span></div>}
              {item.calibration_date && <div><span style={{ color: 'var(--text-muted)' }}>Calibrated: </span><span style={{ color: 'var(--text-primary)' }}>{item.calibration_date}</span></div>}
              {item.calibration_expiry && <div><span style={{ color: 'var(--text-muted)' }}>Expiry: </span><span style={{ color: status === 'expired' ? 'var(--critical)' : status === 'soon' ? '#fbbf24' : 'var(--text-primary)' }}>{item.calibration_expiry}</span></div>}
              {item.ownership === 'Hired' && item.hire_return_date && <div><span style={{ color: 'var(--text-muted)' }}>Return by: </span><span style={{ color: 'var(--text-primary)' }}>{item.hire_return_date}</span></div>}
            </div>
            {item.notes && <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.notes}</p>}
            {/* Calibration certificate */}
            <div className="flex items-center gap-2 flex-wrap">
              {item.cert_file_name ? (
                <>
                  <button onClick={handleDownload}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border"
                    style={{ color: 'var(--accent)', borderColor: 'var(--accent)', background: 'rgba(108,114,245,0.08)' }}>
                    <Download size={12} /> {item.cert_file_name}
                  </button>
                  {canEdit && (
                    <button onClick={handleRemoveCert}
                      className="flex items-center gap-1 text-[10px]"
                      style={{ color: 'var(--text-muted)' }}>
                      <FileX size={11} /> Remove cert
                    </button>
                  )}
                </>
              ) : (
                canEdit && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border disabled:opacity-50"
                    style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                    <Upload size={12} /> {uploading ? 'Uploading…' : 'Upload calibration cert'}
                  </button>
                )
              )}
              <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }} />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

interface Props {
  initialItems: EquipmentItem[]
  companyId: string
  canEdit: boolean
}

export default function EquipmentClient({ initialItems, companyId, canEdit }: Props) {
  const supabase = createClient()
  const [items, setItems] = useState(initialItems)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  function toDb(form: FormState, base?: Partial<EquipmentItem>) {
    return {
      ...base,
      company_id: companyId,
      name: form.name.trim(),
      asset_ref: form.asset_ref.trim() || null,
      serial_number: form.serial_number.trim() || null,
      manufacturer: form.manufacturer.trim() || null,
      model: form.model.trim() || null,
      category: form.category,
      ownership: form.ownership,
      hire_company: form.ownership === 'Hired' ? (form.hire_company.trim() || null) : null,
      hire_return_date: form.ownership === 'Hired' ? (form.hire_return_date || null) : null,
      calibration_date: form.calibration_date || null,
      calibration_expiry: form.calibration_expiry || null,
      notes: form.notes.trim() || null,
    }
  }

  async function handleAdd(form: FormState) {
    setSaving(true)
    const { data, error } = await supabase.from('equipment_items').insert(toDb(form)).select().single()
    setSaving(false)
    if (!error && data) { setItems(prev => [...prev, data as EquipmentItem]); setAdding(false) }
  }

  async function handleEdit(id: string, form: FormState) {
    setSaving(true)
    const { data, error } = await supabase.from('equipment_items')
      .update({ ...toDb(form), updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    setSaving(false)
    if (!error && data) { setItems(prev => prev.map(i => i.id === id ? data as EquipmentItem : i)); setEditingId(null) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this equipment item?')) return
    await supabase.from('equipment_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const q = search.toLowerCase()
  const filtered = items.filter(i => {
    if (catFilter && i.category !== catFilter) return false
    if (statusFilter) {
      const { status } = expiryInfo(i.calibration_expiry)
      if (statusFilter === 'expired' && status !== 'expired') return false
      if (statusFilter === 'soon' && status !== 'soon') return false
      if (statusFilter === 'valid' && status !== 'valid') return false
      if (statusFilter === 'none' && status !== 'none') return false
    }
    if (q) return (
      i.name.toLowerCase().includes(q) ||
      (i.asset_ref ?? '').toLowerCase().includes(q) ||
      (i.serial_number ?? '').toLowerCase().includes(q) ||
      (i.manufacturer ?? '').toLowerCase().includes(q)
    )
    return true
  })

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <Wrench size={20} style={{ color: 'var(--accent)' }} />
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Equipment</h1>
        </div>
        {canEdit && !adding && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg font-medium text-white"
            style={{ background: 'var(--accent)' }}>
            <Plus size={14} /> Add item
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Search equipment…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-40 rounded-lg px-3 py-2 text-sm outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          <option value="">All statuses</option>
          <option value="expired">Expired</option>
          <option value="soon">Expiring soon</option>
          <option value="valid">Valid</option>
          <option value="none">No calibration</option>
        </select>
      </div>

      {/* Add form */}
      {adding && (
        <EquipmentForm initial={emptyForm} onSave={handleAdd} onCancel={() => setAdding(false)} saving={saving} />
      )}

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {filtered.length} item{filtered.length !== 1 ? 's' : ''}{items.length !== filtered.length ? ` of ${items.length}` : ''}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-xl border py-16 text-center" style={{ borderColor: 'var(--border)' }}>
          <Wrench size={32} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {items.length === 0 ? 'No equipment added yet' : 'No items match your filters'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                <th className="px-4 py-2.5 text-left font-medium w-28" style={{ color: 'var(--text-muted)' }}>Calibration</th>
                <th className="px-4 py-2.5 text-left font-medium" style={{ color: 'var(--text-muted)' }}>Name</th>
                <th className="px-4 py-2.5 text-left font-medium w-32 hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>Category</th>
                <th className="px-4 py-2.5 text-left font-medium w-32 hidden lg:table-cell" style={{ color: 'var(--text-muted)' }}>Ownership</th>
                <th className="px-4 py-2.5 text-left font-medium w-28 hidden lg:table-cell" style={{ color: 'var(--text-muted)' }}>Ref / Serial</th>
                {canEdit && <th className="px-4 py-2.5 w-16" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                editingId === item.id ? (
                  <tr key={item.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td colSpan={canEdit ? 6 : 5} className="px-4 py-3">
                      <EquipmentForm
                        initial={{
                          name: item.name,
                          asset_ref: item.asset_ref ?? '',
                          serial_number: item.serial_number ?? '',
                          manufacturer: item.manufacturer ?? '',
                          model: item.model ?? '',
                          category: item.category,
                          ownership: item.ownership,
                          hire_company: item.hire_company ?? '',
                          hire_return_date: item.hire_return_date ?? '',
                          calibration_date: item.calibration_date ?? '',
                          calibration_expiry: item.calibration_expiry ?? '',
                          override_expiry: false,
                          notes: item.notes ?? '',
                        }}
                        onSave={form => handleEdit(item.id, form)}
                        onCancel={() => setEditingId(null)}
                        saving={saving}
                      />
                    </td>
                  </tr>
                ) : (
                  <EquipmentRow
                    key={item.id}
                    item={item}
                    canEdit={canEdit}
                    onEdit={() => setEditingId(item.id)}
                    onDelete={() => handleDelete(item.id)}
                    onUpdate={updated => setItems(prev => prev.map(i => i.id === updated.id ? updated : i))}
                  />
                )
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
