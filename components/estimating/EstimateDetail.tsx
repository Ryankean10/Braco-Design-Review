'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, Download, Send, AlertTriangle, ChevronDown, ChevronUp, BookOpen, Sparkles, Loader2, Check, FileText, X } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────
interface EstimateItem {
  id: string
  estimate_id: string
  section: 'material' | 'labour' | 'plant' | 'other'
  description: string
  quantity: number
  unit: string
  unit_cost: number
  total_cost: number
  markup_pct: number
  person_id: string | null
  is_hire: boolean
  sort_order: number
  notes: string | null
}
interface Person { id: string; name: string; role: string; standard_rate: number | null }
interface Holiday { id: string; person_id: string; start_date: string; end_date: string; status: string }
interface PlantAsset { id: string; name: string; category: string; hire_rate_daily: number | null }
interface JobLibraryJob { id: string; name: string; category: string | null; job_library_items: JobLibraryItem[] }
interface JobLibraryItem { id: string; section: string; description: string; quantity: number; unit: string; unit_cost: number; notes: string | null }
interface Estimate {
  id: string; title: string; description: string | null; client_name: string | null; client_email: string | null
  reference: string; status: string; start_date: string | null; end_date: string | null
  notes: string | null; default_markup_pct: number; estimate_items: EstimateItem[]
}

const GBP = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n)
const UNITS = ['item', 'nr', 'm', 'm²', 'm³', 'kg', 'tonne', 'hr', 'day', 'week', 'ls']

function clientTotal(item: EstimateItem) { return item.total_cost * (1 + item.markup_pct / 100) }

// ── Main component ─────────────────────────────────────────────────────────────
export default function EstimateDetail({
  estimate: init,
  people,
  holidays,
  jobLibrary,
}: {
  estimate: Estimate
  people: Person[]
  holidays: Holiday[]
  jobLibrary: JobLibraryJob[]
}) {
  const [estimate, setEstimate]       = useState(init)
  const [items, setItems]             = useState<EstimateItem[]>(init.estimate_items ?? [])
  const [tab, setTab]                 = useState<'materials' | 'manpower' | 'plant' | 'other' | 'documents' | 'preview'>('materials')
  const [saving, setSaving]           = useState(false)
  const [sendEmail, setSendEmail]     = useState('')
  const [sending, setSending]         = useState(false)
  const [sentOk, setSentOk]           = useState(false)
  const [headerOpen, setHeaderOpen]   = useState(false)
  const [header, setHeader]           = useState({
    title: init.title, description: init.description ?? '', client_name: init.client_name ?? '',
    client_email: init.client_email ?? '', start_date: init.start_date ?? '', end_date: init.end_date ?? '',
    notes: init.notes ?? '', default_markup_pct: init.default_markup_pct,
  })

  const defaultMarkup = estimate.default_markup_pct ?? 15

  async function saveHeader() {
    setSaving(true)
    const res = await fetch(`/api/estimating/${estimate.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(header),
    })
    const { data } = await res.json()
    if (data) { setEstimate(e => ({ ...e, ...data })); setHeaderOpen(false) }
    setSaving(false)
  }

  async function addItem(section: EstimateItem['section'], partial: Partial<EstimateItem>) {
    const body = { section, description: '', quantity: 1, unit: 'item', unit_cost: 0, markup_pct: defaultMarkup, ...partial }
    const res = await fetch(`/api/estimating/${estimate.id}/items`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const { data } = await res.json()
    if (data) setItems(prev => [...prev, ...(Array.isArray(data) ? data : [data])])
  }

  async function updateItem(itemId: string, patch: Partial<EstimateItem>) {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, ...patch, total_cost: ((patch.quantity ?? i.quantity) * (patch.unit_cost ?? i.unit_cost)) } : i))
    await fetch(`/api/estimating/${estimate.id}/items/${itemId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    })
  }

  async function removeItem(itemId: string) {
    setItems(prev => prev.filter(i => i.id !== itemId))
    await fetch(`/api/estimating/${estimate.id}/items/${itemId}`, { method: 'DELETE' })
  }

  async function importFromLibrary(job: JobLibraryJob) {
    const toAdd = job.job_library_items.map((li, idx) => ({
      section: li.section as EstimateItem['section'],
      description: li.description,
      quantity: li.quantity,
      unit: li.unit,
      unit_cost: li.unit_cost,
      markup_pct: defaultMarkup,
      notes: li.notes,
      sort_order: items.length + idx,
    }))
    const res = await fetch(`/api/estimating/${estimate.id}/items`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(toAdd),
    })
    const { data } = await res.json()
    if (data) setItems(prev => [...prev, ...(Array.isArray(data) ? data : [data])])
  }

  async function sendEstimate() {
    if (!sendEmail) return
    setSending(true)
    const res = await fetch(`/api/estimating/${estimate.id}/send`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: sendEmail }),
    })
    if (res.ok) { setSentOk(true); setEstimate(e => ({ ...e, status: 'sent' })); setTimeout(() => setSentOk(false), 4000) }
    setSending(false)
  }

  // Holiday clash check
  function getClashes(personId: string): Holiday[] {
    if (!estimate.start_date || !estimate.end_date) return []
    return holidays.filter(h =>
      h.person_id === personId &&
      h.status === 'Approved' &&
      h.start_date <= estimate.end_date! &&
      h.end_date >= estimate.start_date!
    )
  }

  const sectionItems = (s: EstimateItem['section']) => items.filter(i => i.section === s)

  // Totals
  const subtotal   = items.reduce((s, i) => s + clientTotal(i), 0)
  const vat        = subtotal * 0.20
  const grandTotal = subtotal + vat

  const STATUS_COLORS: Record<string, string> = { draft: '#94a3b8', sent: '#f59e0b', accepted: '#10b981', rejected: '#ef4444', void: '#6b7280' }

  const TABS: { key: typeof tab; label: string }[] = [
    { key: 'materials', label: 'Materials' },
    { key: 'manpower',  label: 'Manpower' },
    { key: 'plant',     label: 'Plant' },
    { key: 'other',     label: 'Other' },
    { key: 'documents', label: 'Documents' },
    { key: 'preview',   label: 'Preview & Send' },
  ]

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="rounded-xl border p-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg-base)', color: 'var(--text-muted)' }}>{estimate.reference}</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white" style={{ background: STATUS_COLORS[estimate.status] ?? '#94a3b8' }}>{estimate.status}</span>
            </div>
            <h1 className="text-lg font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>{estimate.title}</h1>
            {estimate.client_name && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Client: {estimate.client_name}</p>}
            {(estimate.start_date || estimate.end_date) && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {estimate.start_date} {estimate.end_date ? `→ ${estimate.end_date}` : ''}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total (inc. VAT)</p>
              <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{GBP(grandTotal)}</p>
            </div>
            <button onClick={() => setHeaderOpen(o => !o)} className="text-xs px-2.5 py-1 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              {headerOpen ? 'Close' : 'Edit details'}
            </button>
          </div>
        </div>

        {headerOpen && (
          <div className="mt-4 pt-4 border-t space-y-3" style={{ borderColor: 'var(--border)' }}>
            <div className="grid grid-cols-2 gap-3">
              <EField label="Title"><input value={header.title} onChange={e => setHeader(h => ({ ...h, title: e.target.value }))} /></EField>
              <EField label="Default markup %"><input type="text" inputMode="decimal" value={header.default_markup_pct} onChange={e => setHeader(h => ({ ...h, default_markup_pct: parseFloat(e.target.value) || 15 }))} /></EField>
              <EField label="Client name"><input value={header.client_name} onChange={e => setHeader(h => ({ ...h, client_name: e.target.value }))} /></EField>
              <EField label="Client email"><input type="email" value={header.client_email} onChange={e => setHeader(h => ({ ...h, client_email: e.target.value }))} /></EField>
              <EField label="Start date"><input type="date" value={header.start_date} onChange={e => setHeader(h => ({ ...h, start_date: e.target.value }))} /></EField>
              <EField label="End date"><input type="date" value={header.end_date} onChange={e => setHeader(h => ({ ...h, end_date: e.target.value }))} /></EField>
              <EField label="Description" className="col-span-2"><textarea rows={2} value={header.description} onChange={e => setHeader(h => ({ ...h, description: e.target.value }))} /></EField>
              <EField label="Notes" className="col-span-2"><textarea rows={2} value={header.notes} onChange={e => setHeader(h => ({ ...h, notes: e.target.value }))} /></EField>
            </div>
            <button onClick={saveHeader} disabled={saving} className="px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--accent)' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className="px-4 py-2.5 text-sm font-medium transition-colors relative"
            style={{ color: tab === key ? 'var(--accent)' : 'var(--text-muted)' }}>
            {label}
            {tab === key && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ background: 'var(--accent)' }} />}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'materials' && (
        <ItemsSection
          section="material" label="Materials" items={sectionItems('material')}
          onAdd={() => addItem('material', { unit: 'item' })}
          onUpdate={updateItem} onRemove={removeItem}
          estimateId={estimate.id} defaultMarkup={defaultMarkup}
          jobLibrary={jobLibrary} onImport={importFromLibrary}
          showExtract
        />
      )}
      {tab === 'manpower' && (
        <ManpowerSection
          items={sectionItems('labour')}
          people={people}
          getClashes={getClashes}
          onAdd={(personId, name, rate) => addItem('labour', { person_id: personId, description: name, unit: 'day', unit_cost: rate })}
          onUpdate={updateItem} onRemove={removeItem}
          estimateId={estimate.id} defaultMarkup={defaultMarkup}
        />
      )}
      {tab === 'plant' && (
        <ItemsSection
          section="plant" label="Plant & Equipment" items={sectionItems('plant')}
          onAdd={() => addItem('plant', { unit: 'day', is_hire: false })}
          onUpdate={updateItem} onRemove={removeItem}
          estimateId={estimate.id} defaultMarkup={defaultMarkup}
          jobLibrary={[]} onImport={importFromLibrary}
          showHire
        />
      )}
      {tab === 'other' && (
        <ItemsSection
          section="other" label="Other Costs" items={sectionItems('other')}
          onAdd={() => addItem('other', {})}
          onUpdate={updateItem} onRemove={removeItem}
          estimateId={estimate.id} defaultMarkup={defaultMarkup}
          jobLibrary={[]} onImport={importFromLibrary}
        />
      )}
      {tab === 'documents' && (
        <DocumentsSection estimateId={estimate.id} defaultMarkup={defaultMarkup} onItemsAdded={newItems => setItems(prev => [...prev, ...newItems])} />
      )}
      {tab === 'preview' && (
        <PreviewSection
          items={items}
          estimateId={estimate.id}
          clientEmail={estimate.client_email ?? ''}
          sendEmail={sendEmail} setSendEmail={setSendEmail}
          onSend={sendEstimate} sending={sending} sentOk={sentOk}
        />
      )}
    </div>
  )
}

// ── Items section (Materials / Plant / Other) ──────────────────────────────────
function ItemsSection({ section, label, items, onAdd, onUpdate, onRemove, estimateId, defaultMarkup, jobLibrary, onImport, showExtract, showHire }: {
  section: EstimateItem['section']; label: string; items: EstimateItem[]
  onAdd: () => void; onUpdate: (id: string, p: Partial<EstimateItem>) => void; onRemove: (id: string) => void
  estimateId: string; defaultMarkup: number; jobLibrary: JobLibraryJob[]; onImport: (j: JobLibraryJob) => void
  showExtract?: boolean; showHire?: boolean
}) {
  const [libOpen, setLibOpen]       = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extractMsg, setExtractMsg] = useState('')
  const fileRef                     = useRef<HTMLInputElement>(null)

  const sectionTotal = items.reduce((s, i) => s + clientTotal(i), 0)

  async function handleExtract(file: File) {
    setExtracting(true)
    setExtractMsg('Reading document…')
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/estimating/${estimateId}/extract-materials`, { method: 'POST', body: fd })
    const { items: extracted, error } = await res.json()
    if (error) { setExtractMsg(`Error: ${error}`); setExtracting(false); return }
    if (!extracted?.length) { setExtractMsg('No items found in document.'); setExtracting(false); return }
    setExtractMsg(`Extracted ${extracted.length} items — adding…`)
    const body = extracted.map((e: any, idx: number) => ({
      section, description: e.description ?? '', quantity: e.quantity ?? 1,
      unit: e.unit ?? 'item', unit_cost: e.unit_cost ?? 0, markup_pct: defaultMarkup,
      notes: e.notes ?? null, sort_order: items.length + idx,
    }))
    const r2 = await fetch(`/api/estimating/${estimateId}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const { data } = await r2.json()
    if (data) {
      // Trigger page refresh by notifying parent would be complex; use simple reload
      window.location.reload()
    }
    setExtractMsg('')
    setExtracting(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
          {label} — {items.length} items · {GBP(sectionTotal)} (client total)
        </p>
        <div className="flex gap-2">
          {showExtract && (
            <>
              <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt,.csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleExtract(f); e.target.value = '' }} />
              <button
                onClick={() => fileRef.current?.click()} disabled={extracting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                {extracting ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                AI extract from quote
              </button>
            </>
          )}
          {jobLibrary.length > 0 && (
            <button onClick={() => setLibOpen(o => !o)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              <BookOpen size={11} /> Import from library
            </button>
          )}
          <button onClick={onAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: 'var(--accent)' }}>
            <Plus size={11} /> Add item
          </button>
        </div>
      </div>

      {extractMsg && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(91,76,245,0.1)', color: 'var(--accent)' }}>{extractMsg}</p>
      )}

      {libOpen && (
        <div className="rounded-xl border p-3 space-y-2" style={{ background: 'var(--bg-surface)', borderColor: 'var(--accent)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Select a job template to import its items:</p>
          {jobLibrary.map(job => (
            <div key={job.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'var(--bg-base)' }}>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{job.name}</p>
                {job.category && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{job.category} · {job.job_library_items.length} items</p>}
              </div>
              <button onClick={() => { onImport(job); setLibOpen(false) }} className="text-xs px-2.5 py-1 rounded-lg text-white" style={{ background: 'var(--accent)' }}>Import</button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
              <th className="px-3 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Description</th>
              {showHire && <th className="px-3 py-2.5 text-center text-xs font-medium w-16" style={{ color: 'var(--text-muted)' }}>Hire</th>}
              <th className="px-3 py-2.5 text-right text-xs font-medium w-20" style={{ color: 'var(--text-muted)' }}>Qty</th>
              <th className="px-3 py-2.5 text-right text-xs font-medium w-20" style={{ color: 'var(--text-muted)' }}>Unit</th>
              <th className="px-3 py-2.5 text-right text-xs font-medium w-28" style={{ color: 'var(--text-muted)' }}>Unit cost</th>
              <th className="px-3 py-2.5 text-right text-xs font-medium w-20" style={{ color: 'var(--text-muted)' }}>Markup %</th>
              <th className="px-3 py-2.5 text-right text-xs font-medium w-28" style={{ color: 'var(--text-muted)' }}>Client total</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <ItemRow key={item.id} item={item} onUpdate={onUpdate} onRemove={onRemove} showHire={showHire} />
            ))}
            {items.length === 0 && (
              <tr><td colSpan={showHire ? 8 : 7} className="px-3 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No items yet. Add one or use AI extract.</td></tr>
            )}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                <td colSpan={showHire ? 6 : 5} className="px-3 py-2.5 text-right text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Section total (client)</td>
                <td className="px-3 py-2.5 text-right text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{GBP(sectionTotal)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

// ── Inline editable row ────────────────────────────────────────────────────────
function ItemRow({ item, onUpdate, onRemove, showHire }: {
  item: EstimateItem; onUpdate: (id: string, p: Partial<EstimateItem>) => void; onRemove: (id: string) => void; showHire?: boolean
}) {
  const [qty, setQty]   = useState(String(item.quantity))
  const [cost, setCost] = useState(String(item.unit_cost))
  const [mkp, setMkp]   = useState(String(item.markup_pct))

  function commit(field: 'quantity' | 'unit_cost' | 'markup_pct', val: string) {
    const n = parseFloat(val) || 0
    onUpdate(item.id, { [field]: n })
  }

  const clientTot = (parseFloat(qty) || 0) * (parseFloat(cost) || 0) * (1 + (parseFloat(mkp) || 0) / 100)

  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td className="px-3 py-1.5">
        <input
          className="w-full text-sm bg-transparent outline-none"
          style={{ color: 'var(--text-primary)' }}
          value={item.description}
          onChange={e => onUpdate(item.id, { description: e.target.value })}
          placeholder="Description…"
        />
      </td>
      {showHire && (
        <td className="px-3 py-1.5 text-center">
          <input type="checkbox" checked={item.is_hire} onChange={e => onUpdate(item.id, { is_hire: e.target.checked })} />
        </td>
      )}
      <td className="px-3 py-1.5">
        <input className="w-full text-xs text-right bg-transparent outline-none" style={{ color: 'var(--text-primary)' }}
          value={qty} onChange={e => setQty(e.target.value)} onBlur={() => commit('quantity', qty)} />
      </td>
      <td className="px-3 py-1.5">
        <select className="w-full text-xs bg-transparent outline-none" style={{ color: 'var(--text-muted)', colorScheme: 'dark' }}
          value={item.unit} onChange={e => onUpdate(item.id, { unit: e.target.value })}>
          {UNITS.map(u => <option key={u}>{u}</option>)}
        </select>
      </td>
      <td className="px-3 py-1.5">
        <input className="w-full text-xs text-right bg-transparent outline-none" style={{ color: 'var(--text-primary)' }}
          value={cost} onChange={e => { if (/^[\d.]*$/.test(e.target.value)) setCost(e.target.value) }}
          onBlur={() => commit('unit_cost', cost)} placeholder="0.00" />
      </td>
      <td className="px-3 py-1.5">
        <div className="flex items-center justify-end gap-0.5">
          <input className="w-12 text-xs text-right bg-transparent outline-none" style={{ color: 'var(--text-primary)' }}
            value={mkp} onChange={e => { if (/^[\d.]*$/.test(e.target.value)) setMkp(e.target.value) }}
            onBlur={() => commit('markup_pct', mkp)} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>%</span>
        </div>
      </td>
      <td className="px-3 py-1.5 text-right text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
        {GBP(clientTot)}
      </td>
      <td className="px-2 py-1.5">
        <button onClick={() => onRemove(item.id)} className="opacity-40 hover:opacity-100"><Trash2 size={12} style={{ color: 'var(--text-muted)' }} /></button>
      </td>
    </tr>
  )
}

// ── Manpower section ───────────────────────────────────────────────────────────
function ManpowerSection({ items, people, getClashes, onAdd, onUpdate, onRemove, estimateId, defaultMarkup }: {
  items: EstimateItem[]; people: Person[]; getClashes: (id: string) => Holiday[]
  onAdd: (personId: string, name: string, rate: number) => void
  onUpdate: (id: string, p: Partial<EstimateItem>) => void; onRemove: (id: string) => void
  estimateId: string; defaultMarkup: number
}) {
  const [selectedPerson, setSelectedPerson] = useState('')
  const sectionTotal = items.reduce((s, i) => s + clientTotal(i), 0)

  function addPerson() {
    const p = people.find(x => x.id === selectedPerson)
    if (!p) return
    onAdd(p.id, p.name, p.standard_rate ?? 0)
    setSelectedPerson('')
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
          Manpower — {items.length} people · {GBP(sectionTotal)} (client total)
        </p>
        <div className="flex gap-2 items-center">
          <select
            value={selectedPerson}
            onChange={e => setSelectedPerson(e.target.value)}
            style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 13, colorScheme: 'dark' }}>
            <option value="">Select person…</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.name} — {p.role} {p.standard_rate ? `(£${p.standard_rate}/day)` : ''}</option>)}
          </select>
          <button onClick={addPerson} disabled={!selectedPerson} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: 'var(--accent)', opacity: selectedPerson ? 1 : 0.5 }}>
            <Plus size={11} /> Add
          </button>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
              {['Name / Role', 'Days', 'Day rate', 'Markup %', 'Client total', ''].map(h => (
                <th key={h} className={`px-3 py-2.5 text-xs font-medium ${h ? 'text-right' : 'text-left'} first:text-left`} style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const clashes = item.person_id ? getClashes(item.person_id) : []
              return (
                <ManpowerRow key={item.id} item={item} clashes={clashes} onUpdate={onUpdate} onRemove={onRemove} />
              )
            })}
            {items.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No manpower added yet.</td></tr>
            )}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                <td colSpan={4} className="px-3 py-2.5 text-right text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Section total (client)</td>
                <td className="px-3 py-2.5 text-right text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{GBP(sectionTotal)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

function ManpowerRow({ item, clashes, onUpdate, onRemove }: {
  item: EstimateItem; clashes: Holiday[]; onUpdate: (id: string, p: Partial<EstimateItem>) => void; onRemove: (id: string) => void
}) {
  const [days, setDays]   = useState(String(item.quantity))
  const [rate, setRate]   = useState(String(item.unit_cost))
  const [mkp, setMkp]     = useState(String(item.markup_pct))
  const [showClash, setShowClash] = useState(false)

  function commit(field: 'quantity' | 'unit_cost' | 'markup_pct', val: string) {
    onUpdate(item.id, { [field]: parseFloat(val) || 0 })
  }

  const clientTot = (parseFloat(days) || 0) * (parseFloat(rate) || 0) * (1 + (parseFloat(mkp) || 0) / 100)

  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <input className="text-sm bg-transparent outline-none flex-1" style={{ color: 'var(--text-primary)' }}
            value={item.description} onChange={e => onUpdate(item.id, { description: e.target.value })} />
          {clashes.length > 0 && (
            <button onClick={() => setShowClash(o => !o)} title="Holiday clash detected">
              <AlertTriangle size={13} style={{ color: '#f59e0b' }} />
            </button>
          )}
        </div>
        {showClash && clashes.length > 0 && (
          <div className="mt-1 text-xs px-2 py-1 rounded" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
            ⚠ Holiday clash: {clashes.map(c => `${c.start_date} → ${c.end_date}`).join(', ')}
          </div>
        )}
      </td>
      <td className="px-3 py-2">
        <input className="w-full text-xs text-right bg-transparent outline-none" style={{ color: 'var(--text-primary)' }}
          value={days} onChange={e => setDays(e.target.value)} onBlur={() => commit('quantity', days)} />
      </td>
      <td className="px-3 py-2">
        <input className="w-full text-xs text-right bg-transparent outline-none" style={{ color: 'var(--text-primary)' }}
          value={rate} onChange={e => { if (/^[\d.]*$/.test(e.target.value)) setRate(e.target.value) }} onBlur={() => commit('unit_cost', rate)} />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-0.5">
          <input className="w-12 text-xs text-right bg-transparent outline-none" style={{ color: 'var(--text-primary)' }}
            value={mkp} onChange={e => { if (/^[\d.]*$/.test(e.target.value)) setMkp(e.target.value) }} onBlur={() => commit('markup_pct', mkp)} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>%</span>
        </div>
      </td>
      <td className="px-3 py-2 text-right text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{GBP(clientTot)}</td>
      <td className="px-2 py-2">
        <button onClick={() => onRemove(item.id)} className="opacity-40 hover:opacity-100"><Trash2 size={12} style={{ color: 'var(--text-muted)' }} /></button>
      </td>
    </tr>
  )
}

// ── Preview & Send ─────────────────────────────────────────────────────────────
function PreviewSection({ items, estimateId, clientEmail, sendEmail, setSendEmail, onSend, sending, sentOk }: {
  items: EstimateItem[]; estimateId: string; clientEmail: string
  sendEmail: string; setSendEmail: (v: string) => void
  onSend: () => void; sending: boolean; sentOk: boolean
}) {
  const sections = [
    { key: 'material' as const, label: 'Materials' },
    { key: 'labour'   as const, label: 'Labour' },
    { key: 'plant'    as const, label: 'Plant' },
    { key: 'other'    as const, label: 'Other' },
  ]

  let grandSubtotal = 0
  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4 space-y-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        {sections.map(({ key, label }) => {
          const sItems = items.filter(i => i.section === key)
          if (!sItems.length) return null
          const sTot = sItems.reduce((s, i) => s + clientTotal(i), 0)
          grandSubtotal += sTot
          return (
            <div key={key}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--accent)' }}>{label}</p>
              <table className="w-full text-sm">
                <tbody>
                  {sItems.map(i => (
                    <tr key={i.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="py-1.5" style={{ color: 'var(--text-primary)' }}>{i.description}</td>
                      <td className="py-1.5 text-right w-16 text-xs" style={{ color: 'var(--text-muted)' }}>{i.quantity} {i.unit}</td>
                      <td className="py-1.5 text-right w-24 font-medium" style={{ color: 'var(--text-primary)' }}>{GBP(clientTotal(i))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} className="pt-1.5 text-right text-xs italic" style={{ color: 'var(--text-muted)' }}>Subtotal — {label}</td>
                    <td className="pt-1.5 text-right text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{GBP(sTot)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        })}

        <div className="border-t pt-3 space-y-1" style={{ borderColor: 'var(--border)' }}>
          <div className="flex justify-between text-sm" style={{ color: 'var(--text-muted)' }}>
            <span>Subtotal (ex VAT)</span><span>{GBP(grandSubtotal)}</span>
          </div>
          <div className="flex justify-between text-sm" style={{ color: 'var(--text-muted)' }}>
            <span>VAT (20%)</span><span>{GBP(grandSubtotal * 0.20)}</span>
          </div>
          <div className="flex justify-between text-base font-bold pt-1 border-t" style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}>
            <span>Total</span><span>{GBP(grandSubtotal * 1.20)}</span>
          </div>
        </div>
      </div>

      <p className="text-xs px-2 py-1.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
        Markup % is internal only — the download and email show client totals only.
      </p>

      <div className="flex gap-3 flex-wrap">
        <a
          href={`/api/estimating/${estimateId}/download`} target="_blank" rel="noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border"
          style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
          <Download size={14} /> Download / Print
        </a>

        <div className="flex gap-2 flex-1">
          <input
            type="email" value={sendEmail} onChange={e => setSendEmail(e.target.value)}
            placeholder={clientEmail || 'client@example.com'}
            className="flex-1 px-3 py-2 rounded-lg border text-sm"
            style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          />
          <button
            onClick={onSend} disabled={sending || !sendEmail}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: sentOk ? '#10b981' : 'var(--accent)', opacity: (!sendEmail || sending) ? 0.6 : 1 }}>
            {sentOk ? <><Check size={14} /> Sent!</> : sending ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : <><Send size={14} /> Send to client</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Documents section ──────────────────────────────────────────────────────────
interface EstimateDoc { id: string; name: string; file_size: number | null; file_type: string | null; created_at: string }

function DocumentsSection({ estimateId, defaultMarkup, onItemsAdded }: {
  estimateId: string; defaultMarkup: number; onItemsAdded: (items: EstimateItem[]) => void
}) {
  const [docs, setDocs]           = useState<EstimateDoc[]>([])
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const [extractingId, setExtractingId] = useState<string | null>(null)
  const [msgs, setMsgs]           = useState<Record<string, string>>({})
  const fileRef                   = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/estimating/${estimateId}/documents`)
      .then(r => r.json())
      .then(data => { setDocs(Array.isArray(data) ? data : []); setLoading(false) })
  }, [estimateId])

  async function upload(file: File) {
    setUploading(true)
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch(`/api/estimating/${estimateId}/documents`, { method: 'POST', body: fd })
    const data = await res.json()
    if (data.id) setDocs(prev => [data, ...prev])
    setUploading(false)
  }

  async function extract(doc: EstimateDoc) {
    setExtractingId(doc.id)
    setMsgs(m => ({ ...m, [doc.id]: 'Extracting…' }))
    const res = await fetch(`/api/estimating/${estimateId}/documents/${doc.id}/extract`, { method: 'POST' })
    const { items, error } = await res.json()
    if (error) { setMsgs(m => ({ ...m, [doc.id]: `Error: ${error}` })); setExtractingId(null); return }
    if (!items?.length) { setMsgs(m => ({ ...m, [doc.id]: 'No items found.' })); setExtractingId(null); return }
    // Add extracted items via API
    const body = items.map((e: any, idx: number) => ({
      section: 'material', description: e.description ?? '', quantity: e.quantity ?? 1,
      unit: e.unit ?? 'item', unit_cost: e.unit_cost ?? 0, markup_pct: defaultMarkup, notes: e.notes ?? null, sort_order: idx,
    }))
    const r2 = await fetch(`/api/estimating/${estimateId}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const { data } = await r2.json()
    if (data) {
      onItemsAdded(Array.isArray(data) ? data : [data])
      setMsgs(m => ({ ...m, [doc.id]: `✓ Added ${items.length} items to Materials` }))
    }
    setExtractingId(null)
  }

  async function remove(doc: EstimateDoc) {
    await fetch(`/api/estimating/${estimateId}/documents/${doc.id}`, { method: 'DELETE' })
    setDocs(prev => prev.filter(d => d.id !== doc.id))
  }

  function fmtSize(bytes: number | null) {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
          Quotes & order confirmations — {docs.length} file{docs.length !== 1 ? 's' : ''}
        </p>
        <div>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt,.csv,.xlsx" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
          <button
            onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
            style={{ background: 'var(--accent)' }}>
            {uploading ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
            Upload document
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
      ) : docs.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center" style={{ borderColor: 'var(--border)' }}>
          <FileText size={32} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No documents uploaded yet.</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Upload quotes or order confirmations to keep them with this estimate.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="rounded-xl border p-3" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <FileText size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{doc.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {doc.file_type?.toUpperCase()} · {fmtSize(doc.file_size)} · {new Date(doc.created_at).toLocaleDateString('en-GB')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => extract(doc)} disabled={extractingId === doc.id}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                    {extractingId === doc.id ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                    Extract items
                  </button>
                  <button onClick={() => remove(doc)} className="p-1 rounded opacity-40 hover:opacity-100">
                    <X size={13} style={{ color: 'var(--text-muted)' }} />
                  </button>
                </div>
              </div>
              {msgs[doc.id] && (
                <p className="mt-2 text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(91,76,245,0.1)', color: 'var(--accent)' }}>
                  {msgs[doc.id]}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
        "Extract items" runs AI extraction and adds line items to the Materials tab.
      </p>
    </div>
  )
}

// ── Shared form field ──────────────────────────────────────────────────────────
function EField({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <div className="[&>input]:w-full [&>textarea]:w-full [&>input]:px-3 [&>textarea]:px-3 [&>input]:py-1.5 [&>textarea]:py-1.5 [&>input]:rounded-lg [&>textarea]:rounded-lg [&>input]:border [&>textarea]:border [&>input]:text-sm [&>textarea]:text-sm [&>input]:bg-transparent [&>textarea]:bg-transparent"
        style={{ ['--tw-ring-color' as any]: 'transparent' }}>
        {children}
      </div>
    </div>
  )
}
