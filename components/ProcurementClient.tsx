'use client'

import { useState, useRef } from 'react'
import {
  Sparkles, Plus, ChevronDown, ChevronRight, AlertTriangle,
  Clock, PoundSterling, Upload, X, Check, Pencil, Trash2,
  CheckSquare, Square, FileText
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = [
  'BESS Equipment','HV Electrical','LV Electrical','Protection & Control',
  'Transformer','Switchgear','Cables & Containment','Civil & Structural',
  'Mechanical & HVAC','Fire Suppression','Telecoms & SCADA','Other'
]
const STATUSES = ['Draft','Quoted','PO Raised','Ordered','Delivered','Cancelled']

interface Quote {
  id: string
  item_id: string
  supplier_name: string | null
  quote_ref: string | null
  quote_date: string | null
  validity_date: string | null
  unit_price: number | null
  total_price: number | null
  currency: string
  lead_time_weeks: number | null
  storage_path: string | null
  file_name: string | null
  file_type: string | null
  ai_extracted: boolean
  is_preferred: boolean
  notes: string | null
  created_at: string
}

interface Item {
  id: string
  project_id: string
  title: string
  description: string | null
  category: string
  quantity: number | null
  unit: string | null
  required_by_date: string | null
  estimated_lead_weeks: number | null
  order_by_date: string | null
  status: string
  spec_matched: boolean | null
  spec_notes: string | null
  er_extracted: boolean
  notes: string | null
  created_at: string
  procurement_quotes: Quote[]
}

interface Supplier {
  id: string
  company_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  categories: string[]
}

interface Props {
  projectId: string
  hasER: boolean
  initialItems: Item[]
  suppliers: Supplier[]
  canEdit: boolean
}

function orderWarning(item: Item): 'overdue' | 'urgent' | 'soon' | null {
  if (!item.order_by_date) return null
  const days = Math.ceil((new Date(item.order_by_date).getTime() - Date.now()) / 86400000)
  if (days < 0) return 'overdue'
  if (days <= 14) return 'urgent'
  if (days <= 28) return 'soon'
  return null
}

function bestQuote(quotes: Quote[]): Quote | null {
  const valid = quotes.filter(q => q.total_price || q.unit_price)
  if (!valid.length) return null
  const preferred = valid.find(q => q.is_preferred)
  if (preferred) return preferred
  return valid.reduce((a, b) => {
    const ap = a.total_price ?? a.unit_price ?? Infinity
    const bp = b.total_price ?? b.unit_price ?? Infinity
    return ap <= bp ? a : b
  })
}

function fmt(p: number | null, currency = 'GBP') {
  if (p == null) return '—'
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(p)
}

function StatusBadge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    Draft: '#374151', Quoted: '#1d4ed8', 'PO Raised': '#7c3aed',
    Ordered: '#92400e', Delivered: '#166534', Cancelled: '#7f1d1d',
  }
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium text-white"
      style={{ background: colours[status] ?? '#374151' }}>
      {status}
    </span>
  )
}

function WarningChip({ level }: { level: 'overdue' | 'urgent' | 'soon' }) {
  const config = {
    overdue: { bg: 'var(--critical)', label: 'ORDER OVERDUE' },
    urgent:  { bg: 'var(--major)',    label: 'ORDER URGENT' },
    soon:    { bg: 'var(--minor)',    label: 'ORDER SOON' },
  }[level]
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold text-white animate-pulse"
      style={{ background: config.bg }}>
      {config.label}
    </span>
  )
}

function QuoteCard({
  quote, itemId, projectId, onUpdated, onDeleted, canEdit, suppliers,
}: {
  quote: Quote; itemId: string; projectId: string
  onUpdated: (q: Quote) => void; onDeleted: (id: string) => void
  canEdit: boolean; suppliers: Supplier[]
}) {
  const [extracting, setExtracting] = useState(false)
  const [extractMsg, setExtractMsg] = useState('')
  const supabase = createClient()

  async function extractQuote() {
    setExtracting(true)
    setExtractMsg('Extracting…')
    const res = await fetch(`/api/projects/${projectId}/extract-quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteId: quote.id }),
    })
    const data = await res.json()
    setExtracting(false)
    if (!res.ok) { setExtractMsg(data.error); return }
    setExtractMsg('Extracted')
    // Refresh quote
    const { data: updated } = await supabase.from('procurement_quotes').select('*').eq('id', quote.id).single()
    if (updated) onUpdated(updated)
  }

  async function togglePreferred() {
    await supabase.from('procurement_quotes').update({ is_preferred: !quote.is_preferred }).eq('id', quote.id)
    onUpdated({ ...quote, is_preferred: !quote.is_preferred })
  }

  async function deleteQuote() {
    if (!confirm('Delete this quote?')) return
    if (quote.storage_path) await supabase.storage.from('documents').remove([quote.storage_path])
    await supabase.from('procurement_quotes').delete().eq('id', quote.id)
    onDeleted(quote.id)
  }

  const price = quote.total_price ?? quote.unit_price

  return (
    <div className="rounded-lg border p-3 space-y-2"
      style={{ borderColor: quote.is_preferred ? 'var(--accent)' : 'var(--border)', background: 'var(--bg-surface)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
              {quote.supplier_name ?? 'Unknown supplier'}
            </span>
            {quote.is_preferred && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium text-white" style={{ background: 'var(--accent)' }}>Preferred</span>
            )}
            {quote.ai_extracted && (
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>AI extracted</span>
            )}
          </div>
          <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            {price != null && <span className="font-semibold" style={{ color: 'var(--success)' }}>{fmt(price, quote.currency)}</span>}
            {quote.lead_time_weeks != null && <span><Clock size={10} className="inline mr-0.5" />{quote.lead_time_weeks}w lead</span>}
            {quote.quote_ref && <span>Ref: {quote.quote_ref}</span>}
            {quote.validity_date && <span>Valid to: {new Date(quote.validity_date).toLocaleDateString('en-GB')}</span>}
          </div>
          {quote.notes && <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{quote.notes}</p>}
        </div>
        {canEdit && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {quote.storage_path && !quote.ai_extracted && (
              <button onClick={extractQuote} disabled={extracting} title="Extract with AI"
                className="text-[10px] flex items-center gap-1 px-2 py-1 rounded border disabled:opacity-50"
                style={{ borderColor: 'var(--border)', color: 'var(--accent)' }}>
                <Sparkles size={10} className={extracting ? 'animate-pulse' : ''} />
                {extracting ? 'Extracting…' : 'Extract'}
              </button>
            )}
            <button onClick={togglePreferred} title={quote.is_preferred ? 'Remove preferred' : 'Mark preferred'}
              style={{ color: quote.is_preferred ? 'var(--accent)' : 'var(--text-muted)' }}>
              <Check size={13} />
            </button>
            <button onClick={deleteQuote} style={{ color: 'var(--critical)' }}><Trash2 size={12} /></button>
          </div>
        )}
      </div>
      {extractMsg && <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{extractMsg}</p>}
    </div>
  )
}

function AddQuoteForm({ itemId, projectId, onAdded, onClose, suppliers }: {
  itemId: string; projectId: string; onAdded: (q: Quote) => void; onClose: () => void; suppliers: Supplier[]
}) {
  const [supplierName, setSupplierName] = useState('')
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  async function handleFile(file: File) {
    setUploading(true)
    const ext = file.name.split('.').pop()?.toLowerCase()
    const fileType = ext === 'pdf' ? 'pdf' : ['txt','eml','msg'].includes(ext ?? '') ? 'email' : 'other'
    const path = `${projectId}/quotes/${itemId}/${Date.now()}-${file.name.replace(/\s+/g,'_')}`
    await supabase.storage.from('documents').upload(path, file, { upsert: false })
    const { data } = await supabase.from('procurement_quotes').insert({
      item_id: itemId,
      supplier_name: supplierName || null,
      storage_path: path,
      file_name: file.name,
      file_type: fileType,
    }).select().single()
    setUploading(false)
    if (data) { onAdded(data); onClose() }
  }

  return (
    <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: 'var(--accent)', background: 'var(--bg-surface)' }}>
      <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Add quote</p>
      <input
        type="text"
        placeholder="Supplier name (optional)"
        value={supplierName}
        onChange={e => setSupplierName(e.target.value)}
        className="w-full rounded px-2.5 py-1.5 text-xs outline-none"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
      />
      <div
        className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:opacity-80"
        style={{ borderColor: 'var(--border)' }}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
      >
        <Upload size={16} className="mx-auto mb-1" style={{ color: 'var(--text-muted)' }} />
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {uploading ? 'Uploading…' : 'Drop PDF or email file, or click to browse'}
        </p>
        <input ref={inputRef} type="file" accept=".pdf,.txt,.eml,.msg,.docx" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
      </div>
      <div className="flex justify-end">
        <button onClick={onClose} className="text-xs px-2.5 py-1 rounded border"
          style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>Cancel</button>
      </div>
    </div>
  )
}

function ProcurementItemRow({ item: initItem, canEdit, projectId, suppliers, onDeleted }: {
  item: Item; canEdit: boolean; projectId: string; suppliers: Supplier[]; onDeleted: (id: string) => void
}) {
  const [item, setItem] = useState(initItem)
  const [open, setOpen] = useState(false)
  const [addingQuote, setAddingQuote] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const best = bestQuote(item.procurement_quotes)
  const warning = orderWarning(item)

  function updateQuote(q: Quote) {
    setItem(prev => ({ ...prev, procurement_quotes: prev.procurement_quotes.map(x => x.id === q.id ? q : x) }))
  }
  function removeQuote(id: string) {
    setItem(prev => ({ ...prev, procurement_quotes: prev.procurement_quotes.filter(q => q.id !== id) }))
  }
  function addQuote(q: Quote) {
    setItem(prev => ({ ...prev, procurement_quotes: [...prev.procurement_quotes, q] }))
  }

  async function toggleSpec() {
    const next = !item.spec_matched
    await supabase.from('procurement_items').update({ spec_matched: next }).eq('id', item.id)
    setItem(prev => ({ ...prev, spec_matched: next }))
  }

  async function saveEdit(form: Partial<Item>) {
    setSaving(true)
    const { data } = await supabase.from('procurement_items').update({ ...form, updated_at: new Date().toISOString() }).eq('id', item.id).select().single()
    setSaving(false)
    if (data) { setItem({ ...data, procurement_quotes: item.procurement_quotes }); setEditing(false) }
  }

  async function deleteItem() {
    if (!confirm('Delete this item and all its quotes?')) return
    await supabase.from('procurement_items').delete().eq('id', item.id)
    onDeleted(item.id)
  }

  const field = {
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', borderRadius: '0.375rem',
    padding: '0.375rem 0.625rem', fontSize: '0.75rem', outline: 'none', width: '100%',
  } as React.CSSProperties

  return (
    <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      {/* Headline row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:opacity-90 transition-opacity"
        style={{ background: 'var(--bg-surface)' }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{item.title}</span>
            <StatusBadge status={item.status} />
            {item.er_extracted && (
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(108,114,245,0.15)', color: 'var(--accent)' }}>ER</span>
            )}
            {warning && <WarningChip level={warning} />}
          </div>
          <div className="flex flex-wrap gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>{item.category}</span>
            {best && (
              <span className="font-semibold" style={{ color: 'var(--success)' }}>
                <PoundSterling size={10} className="inline" />{fmt(best.total_price ?? best.unit_price, best.currency).replace('£','').trim()}
                {item.procurement_quotes.length > 1 && ` (${item.procurement_quotes.length} quotes)`}
              </span>
            )}
            {item.estimated_lead_weeks && <span><Clock size={10} className="inline mr-0.5" />{item.estimated_lead_weeks}w est.</span>}
            {item.order_by_date && (
              <span style={{ color: warning ? 'var(--critical)' : 'var(--text-muted)' }}>
                Order by {new Date(item.order_by_date).toLocaleDateString('en-GB')}
              </span>
            )}
          </div>
        </div>

        {/* Spec match checkbox */}
        <button
          onClick={e => { e.stopPropagation(); if (canEdit) toggleSpec() }}
          title="Spec / design matched"
          className="flex-shrink-0 flex items-center gap-1 text-[10px]"
          style={{ color: item.spec_matched ? 'var(--success)' : 'var(--text-muted)' }}
        >
          {item.spec_matched ? <CheckSquare size={14} /> : <Square size={14} />}
          <span className="hidden sm:inline">Spec</span>
        </button>

        {canEdit && (
          <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button onClick={() => { setEditing(e => !e); setOpen(true) }} style={{ color: 'var(--text-muted)' }}><Pencil size={13} /></button>
            <button onClick={deleteItem} style={{ color: 'var(--critical)' }}><Trash2 size={13} /></button>
          </div>
        )}
      </div>

      {/* Expanded content */}
      {open && (
        <div className="px-4 pb-4 space-y-3" style={{ background: 'var(--bg-elevated)' }}>
          {editing ? (
            <EditItemForm item={item} onSave={saveEdit} onCancel={() => setEditing(false)} saving={saving} />
          ) : (
            <>
              {item.description && <p className="text-xs pt-2" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.description}</p>}
              {item.notes && <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>{item.notes}</p>}
              <div className="flex flex-wrap gap-4 text-xs pt-1" style={{ color: 'var(--text-muted)' }}>
                {item.quantity && <span>Qty: {item.quantity}{item.unit ? ` ${item.unit}` : ''}</span>}
                {item.required_by_date && <span>Required by: {new Date(item.required_by_date).toLocaleDateString('en-GB')}</span>}
                {item.estimated_lead_weeks && <span>Lead time: {item.estimated_lead_weeks} weeks</span>}
                {item.order_by_date && <span style={{ fontWeight: 600, color: warning ? 'var(--critical)' : 'var(--text-primary)' }}>
                  Order by: {new Date(item.order_by_date).toLocaleDateString('en-GB')}
                </span>}
              </div>
            </>
          )}

          {/* Quotes */}
          <div className="space-y-2 pt-1">
            <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              Quotes ({item.procurement_quotes.length})
            </p>
            {item.procurement_quotes.map(q => (
              <QuoteCard key={q.id} quote={q} itemId={item.id} projectId={projectId}
                onUpdated={updateQuote} onDeleted={removeQuote} canEdit={canEdit} suppliers={suppliers} />
            ))}
            {addingQuote
              ? <AddQuoteForm itemId={item.id} projectId={projectId} onAdded={addQuote} onClose={() => setAddingQuote(false)} suppliers={suppliers} />
              : canEdit && (
                <button onClick={() => setAddingQuote(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border w-full justify-center hover:opacity-80"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', borderStyle: 'dashed' }}>
                  <Plus size={12} /> Add quote
                </button>
              )
            }
          </div>
        </div>
      )}
    </div>
  )
}

function EditItemForm({ item, onSave, onCancel, saving }: { item: Item; onSave: (f: Partial<Item>) => void; onCancel: () => void; saving: boolean }) {
  const [form, setForm] = useState({
    title: item.title,
    description: item.description ?? '',
    category: item.category,
    quantity: item.quantity ?? '',
    unit: item.unit ?? '',
    required_by_date: item.required_by_date ?? '',
    estimated_lead_weeks: item.estimated_lead_weeks ?? '',
    status: item.status,
    notes: item.notes ?? '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const field = {
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', borderRadius: '0.375rem',
    padding: '0.375rem 0.625rem', fontSize: '0.75rem', outline: 'none', width: '100%',
  } as React.CSSProperties

  return (
    <div className="space-y-2 pt-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2"><input style={field} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Title" /></div>
        <select style={field} value={form.category} onChange={e => set('category', e.target.value)}>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select style={field} value={form.status} onChange={e => set('status', e.target.value)}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <input style={field} type="number" value={form.quantity} onChange={e => set('quantity', e.target.value)} placeholder="Qty" />
        <input style={field} value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="Unit (nr/m/lot)" />
        <div>
          <label className="text-[10px] block mb-0.5" style={{ color: 'var(--text-muted)' }}>Required by</label>
          <input style={field} type="date" value={form.required_by_date} onChange={e => set('required_by_date', e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] block mb-0.5" style={{ color: 'var(--text-muted)' }}>Lead time (weeks)</label>
          <input style={field} type="number" value={form.estimated_lead_weeks} onChange={e => set('estimated_lead_weeks', e.target.value)} placeholder="e.g. 52" />
        </div>
        <div className="col-span-2"><textarea style={{ ...field, minHeight: 60, resize: 'vertical' }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Description" /></div>
        <div className="col-span-2"><textarea style={{ ...field, minHeight: 40, resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Notes" /></div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded border" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>Cancel</button>
        <button onClick={() => onSave({
          title: form.title, description: form.description || null, category: form.category,
          quantity: form.quantity ? Number(form.quantity) : null, unit: form.unit || null,
          required_by_date: form.required_by_date || null,
          estimated_lead_weeks: form.estimated_lead_weeks ? Number(form.estimated_lead_weeks) : null,
          status: form.status, notes: form.notes || null,
        })} disabled={saving} className="text-xs px-3 py-1.5 rounded font-medium text-white disabled:opacity-50"
          style={{ background: 'var(--accent)' }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

const EMPTY_ITEM = { title:'', description:'', category:'Other', quantity:'', unit:'', required_by_date:'', estimated_lead_weeks:'', status:'Draft', notes:'' }

export default function ProcurementClient({ projectId, hasER, initialItems, suppliers, canEdit }: Props) {
  const [items, setItems] = useState(initialItems)
  const [extracting, setExtracting] = useState(false)
  const [extractMsg, setExtractMsg] = useState('')
  const [addingItem, setAddingItem] = useState(false)
  const [newItem, setNewItem] = useState(EMPTY_ITEM)
  const [saving, setSaving] = useState(false)
  const [catFilter, setCatFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const supabase = createClient()

  async function extractFromER() {
    setExtracting(true)
    setExtractMsg('')
    const res = await fetch(`/api/projects/${projectId}/extract-procurement`, { method: 'POST' })
    const text = await res.text()
    setExtracting(false)
    let data: any
    try { data = JSON.parse(text) } catch { setExtractMsg(text.slice(0, 200)); return }
    if (!res.ok) { setExtractMsg(data.error); return }
    setExtractMsg(`${data.inserted} item${data.inserted !== 1 ? 's' : ''} added${data.skipped ? `, ${data.skipped} already existed` : ''}`)
    // Reload items
    const { data: fresh } = await supabase.from('procurement_items').select('*, procurement_quotes(*)').eq('project_id', projectId).order('category').order('created_at')
    if (fresh) setItems(fresh)
  }

  async function addItem() {
    if (!newItem.title.trim()) return
    setSaving(true)
    const { data } = await supabase.from('procurement_items').insert({
      project_id: projectId,
      title: newItem.title,
      description: newItem.description || null,
      category: newItem.category,
      quantity: newItem.quantity ? Number(newItem.quantity) : null,
      unit: newItem.unit || null,
      required_by_date: newItem.required_by_date || null,
      estimated_lead_weeks: newItem.estimated_lead_weeks ? Number(newItem.estimated_lead_weeks) : null,
      status: newItem.status,
      notes: newItem.notes || null,
    }).select('*, procurement_quotes(*)').single()
    setSaving(false)
    if (data) { setItems(prev => [...prev, data]); setAddingItem(false); setNewItem(EMPTY_ITEM) }
  }

  const filtered = items.filter(i =>
    (!catFilter || i.category === catFilter) &&
    (!statusFilter || i.status === statusFilter)
  )

  const warnings = items.filter(i => orderWarning(i))
  const totalBestPrice = items.reduce((sum, i) => {
    const b = bestQuote(i.procurement_quotes)
    return sum + (b?.total_price ?? b?.unit_price ?? 0)
  }, 0)

  const field = {
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', borderRadius: '0.5rem',
    padding: '0.5rem 0.75rem', fontSize: '0.75rem', outline: 'none', width: '100%',
  } as React.CSSProperties

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Items', value: items.length },
          { label: 'Quoted', value: items.filter(i => i.procurement_quotes.length > 0).length },
          { label: 'Warnings', value: warnings.length, alert: warnings.length > 0 },
          { label: 'Best-price total', value: totalBestPrice ? fmt(totalBestPrice) : '—' },
        ].map(c => (
          <div key={c.label} className="rounded-xl border p-4 text-center"
            style={{ background: 'var(--bg-surface)', borderColor: c.alert ? 'var(--critical)' : 'var(--border)' }}>
            <p className="text-xl font-bold" style={{ color: c.alert ? 'var(--critical)' : 'var(--accent)' }}>{c.value}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        {hasER && canEdit && (
          <button onClick={extractFromER} disabled={extracting}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg font-medium text-white disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, var(--accent), #a855f7)' }}>
            <Sparkles size={14} className={extracting ? 'animate-pulse' : ''} />
            {extracting ? 'Extracting from ER…' : 'Extract items from ER'}
          </button>
        )}
        {canEdit && !addingItem && (
          <button onClick={() => setAddingItem(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
            <Plus size={14} /> Add item
          </button>
        )}
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm outline-none ml-auto"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {extractMsg && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{extractMsg}</p>}

      {/* Add item form */}
      {addingItem && (
        <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: 'var(--accent)', background: 'var(--bg-surface)' }}>
          <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>New procurement item</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2"><input style={field} value={newItem.title} onChange={e => setNewItem(f => ({...f, title: e.target.value}))} placeholder="Item title *" /></div>
            <select style={field} value={newItem.category} onChange={e => setNewItem(f => ({...f, category: e.target.value}))}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <input style={field} type="number" value={newItem.estimated_lead_weeks} onChange={e => setNewItem(f => ({...f, estimated_lead_weeks: e.target.value}))} placeholder="Lead time (weeks)" />
            <div>
              <label className="text-[10px] block mb-0.5" style={{ color: 'var(--text-muted)' }}>Required by</label>
              <input style={field} type="date" value={newItem.required_by_date} onChange={e => setNewItem(f => ({...f, required_by_date: e.target.value}))} />
            </div>
            <input style={field} value={newItem.unit} onChange={e => setNewItem(f => ({...f, unit: e.target.value}))} placeholder="Unit (nr/m/lot)" />
            <div className="col-span-2"><textarea style={{...field, minHeight:60, resize:'vertical'}} value={newItem.description} onChange={e => setNewItem(f => ({...f, description: e.target.value}))} placeholder="Description" /></div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setAddingItem(false); setNewItem(EMPTY_ITEM) }}
              className="text-xs px-3 py-1.5 rounded border" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>Cancel</button>
            <button onClick={addItem} disabled={saving || !newItem.title.trim()}
              className="text-xs px-3 py-1.5 rounded font-medium text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>
              {saving ? 'Saving…' : 'Add item'}
            </button>
          </div>
        </div>
      )}

      {/* Items list */}
      <div className="space-y-2">
        {filtered.length === 0
          ? <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
              <FileText size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No procurement items yet</p>
              {hasER && canEdit && <p className="text-xs mt-1">Use "Extract items from ER" to populate automatically</p>}
            </div>
          : filtered.map(item => (
            <ProcurementItemRow key={item.id} item={item} canEdit={canEdit} projectId={projectId}
              suppliers={suppliers} onDeleted={id => setItems(prev => prev.filter(i => i.id !== id))} />
          ))
        }
      </div>
    </div>
  )
}
