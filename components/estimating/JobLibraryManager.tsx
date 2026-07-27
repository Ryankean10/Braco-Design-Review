'use client'

import { useState } from 'react'
import { Plus, Trash2, ChevronDown } from 'lucide-react'

interface LibItem { id: string; section: string; description: string; quantity: number; unit: string; unit_cost: number; notes: string | null }
interface LibJob  { id: string; name: string; description: string | null; category: string | null; job_library_items: LibItem[] }

const GBP = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n)
const SECTIONS = ['material', 'labour', 'plant', 'other'] as const
const UNITS = ['item', 'nr', 'm', 'm²', 'm³', 'kg', 'tonne', 'hr', 'day', 'week', 'ls']

export default function JobLibraryManager({ jobs: init }: { jobs: LibJob[] }) {
  const [jobs, setJobs]       = useState<LibJob[]>(init)
  const [expanded, setExp]    = useState<string | null>(null)
  const [newJob, setNewJob]   = useState({ name: '', category: '', description: '' })
  const [adding, setAdding]   = useState(false)
  const [saving, setSaving]   = useState(false)

  async function createJob() {
    if (!newJob.name.trim()) return
    setSaving(true)
    const res = await fetch('/api/estimating/job-library', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newJob.name.trim(), category: newJob.category || null, description: newJob.description || null }),
    })
    const { data } = await res.json()
    if (data) { setJobs(j => [...j, { ...data, job_library_items: [] }]); setAdding(false); setNewJob({ name: '', category: '', description: '' }) }
    setSaving(false)
  }

  async function deleteJob(id: string) {
    await fetch(`/api/estimating/job-library/${id}`, { method: 'DELETE' })
    setJobs(j => j.filter(x => x.id !== id))
  }

  async function addItem(jobId: string, item: Omit<LibItem, 'id'>) {
    const res = await fetch(`/api/estimating/job-library/${jobId}/items`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    })
    const { data } = await res.json()
    if (data) setJobs(j => j.map(x => x.id === jobId ? { ...x, job_library_items: [...x.job_library_items, ...(Array.isArray(data) ? data : [data])] } : x))
  }

  async function deleteItem(jobId: string, itemId: string) {
    await fetch(`/api/estimating/job-library/${jobId}/items`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId }),
    })
    setJobs(j => j.map(x => x.id === jobId ? { ...x, job_library_items: x.job_library_items.filter(i => i.id !== itemId) } : x))
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--accent)' }}>
          <Plus size={14} /> Add job template
        </button>
      </div>

      {adding && (
        <div className="rounded-xl border p-4 space-y-3" style={{ background: 'var(--bg-surface)', borderColor: 'var(--accent)' }}>
          <div className="grid grid-cols-2 gap-3">
            <F label="Job name *"><input value={newJob.name} onChange={e => setNewJob(n => ({ ...n, name: e.target.value }))} placeholder="e.g. Post & rail fencing" /></F>
            <F label="Category"><input value={newJob.category} onChange={e => setNewJob(n => ({ ...n, category: e.target.value }))} placeholder="e.g. Fencing, Groundworks" /></F>
            <F label="Description" className="col-span-2"><input value={newJob.description} onChange={e => setNewJob(n => ({ ...n, description: e.target.value }))} /></F>
          </div>
          <div className="flex gap-2">
            <button onClick={createJob} disabled={saving || !newJob.name.trim()} className="px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--accent)' }}>Save</button>
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 rounded-lg text-sm" style={{ color: 'var(--text-muted)' }}>Cancel</button>
          </div>
        </div>
      )}

      {jobs.length === 0 && !adding && (
        <div className="rounded-xl border p-10 text-center" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No job templates yet. Add one to get started.</p>
        </div>
      )}

      {jobs.map(job => (
        <div key={job.id} className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1">
              <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{job.name}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {job.category && <span>{job.category} · </span>}
                {job.job_library_items.length} items
              </p>
            </div>
            <button onClick={() => setExp(expanded === job.id ? null : job.id)} className="text-xs px-2.5 py-1 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              {expanded === job.id ? 'Close' : 'Edit items'}
            </button>
            <button onClick={() => deleteJob(job.id)} className="opacity-40 hover:opacity-100"><Trash2 size={13} style={{ color: 'var(--text-muted)' }} /></button>
          </div>

          {expanded === job.id && (
            <div className="border-t" style={{ borderColor: 'var(--border)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border)' }}>
                    {['Section', 'Description', 'Qty', 'Unit', 'Unit cost', ''].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {job.job_library_items.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="px-3 py-2 text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{item.section}</td>
                      <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-primary)' }}>{item.description}</td>
                      <td className="px-3 py-2 text-xs text-right" style={{ color: 'var(--text-muted)' }}>{item.quantity}</td>
                      <td className="px-3 py-2 text-xs text-right" style={{ color: 'var(--text-muted)' }}>{item.unit}</td>
                      <td className="px-3 py-2 text-xs text-right" style={{ color: 'var(--text-primary)' }}>{GBP(item.unit_cost)}</td>
                      <td className="px-2 py-2">
                        <button onClick={() => deleteItem(job.id, item.id)} className="opacity-40 hover:opacity-100"><Trash2 size={12} style={{ color: 'var(--text-muted)' }} /></button>
                      </td>
                    </tr>
                  ))}
                  {job.job_library_items.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-4 text-xs text-center" style={{ color: 'var(--text-muted)' }}>No items yet.</td></tr>
                  )}
                </tbody>
              </table>
              <AddLibItemRow jobId={job.id} onAdd={item => addItem(job.id, item)} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function AddLibItemRow({ jobId, onAdd }: { jobId: string; onAdd: (item: Omit<LibItem, 'id'>) => void }) {
  const [form, setForm] = useState({ section: 'material', description: '', quantity: '1', unit: 'item', unit_cost: '', notes: '' })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.description.trim()) return
    setSaving(true)
    await onAdd({ section: form.section, description: form.description.trim(), quantity: parseFloat(form.quantity) || 1, unit: form.unit, unit_cost: parseFloat(form.unit_cost) || 0, notes: form.notes || null })
    setForm(f => ({ ...f, description: '', quantity: '1', unit_cost: '' }))
    setSaving(false)
  }

  return (
    <div className="flex gap-2 px-3 py-2 border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg-base)' }}>
      <select value={form.section} onChange={e => setForm(f => ({ ...f, section: e.target.value }))}
        className="text-xs rounded border px-1.5 py-1" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)', colorScheme: 'dark' }}>
        {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        placeholder="Description" className="flex-1 text-xs rounded border px-2 py-1"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
      <input value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
        placeholder="Qty" className="w-14 text-xs text-right rounded border px-2 py-1"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
      <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
        className="text-xs rounded border px-1.5 py-1" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)', colorScheme: 'dark' }}>
        {UNITS.map(u => <option key={u}>{u}</option>)}
      </select>
      <input value={form.unit_cost} onChange={e => { if (/^[\d.]*$/.test(e.target.value)) setForm(f => ({ ...f, unit_cost: e.target.value })) }}
        placeholder="Cost" className="w-20 text-xs text-right rounded border px-2 py-1"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
      <button onClick={save} disabled={saving || !form.description.trim()} className="px-2.5 py-1 rounded text-xs font-medium text-white" style={{ background: 'var(--accent)', opacity: !form.description.trim() ? 0.5 : 1 }}>
        <Plus size={11} />
      </button>
    </div>
  )
}

function F({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <div className="[&>input]:w-full [&>input]:px-3 [&>input]:py-1.5 [&>input]:rounded-lg [&>input]:border [&>input]:text-sm [&>input]:bg-transparent">
        {children}
      </div>
    </div>
  )
}
