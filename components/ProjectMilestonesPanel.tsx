'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, CheckCircle2, Clock, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'

interface Milestone {
  id: string
  label: string
  amount: number | null
  currency: string
  agreed_date: string | null
  due_date: string | null
  status: 'pending' | 'invoiced' | 'paid' | 'overdue'
  invoice_ref: string | null
  notes: string | null
}

const STATUS_CFG = {
  pending:  { label: 'Pending',  color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',  icon: <Clock size={11} /> },
  invoiced: { label: 'Invoiced', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',   icon: <Clock size={11} /> },
  paid:     { label: 'Paid',     color: '#4ade80', bg: 'rgba(74,222,128,0.1)',   icon: <CheckCircle2 size={11} /> },
  overdue:  { label: 'Overdue',  color: '#f87171', bg: 'rgba(248,113,113,0.1)', icon: <AlertCircle size={11} /> },
}

function fmt(amount: number | null, currency: string) {
  if (amount == null) return '—'
  return `${currency} ${amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
}

export default function ProjectMilestonesPanel({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ label: '', amount: '', currency: 'GBP', agreed_date: '', due_date: '', invoice_ref: '', notes: '' })
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/projects/${projectId}/milestones`)
    if (res.ok) setMilestones(await res.json())
    setLoading(false)
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch(`/api/projects/${projectId}/milestones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const m = await res.json()
      setMilestones(prev => [...prev, m])
      setForm({ label: '', amount: '', currency: 'GBP', agreed_date: '', due_date: '', invoice_ref: '', notes: '' })
      setShowAdd(false)
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to add')
    }
    setSaving(false)
  }

  async function updateStatus(id: string, newStatus: string) {
    const res = await fetch(`/api/projects/${projectId}/milestones/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      const updated = await res.json()
      setMilestones(prev => prev.map(m => m.id === id ? updated : m))
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this milestone?')) return
    await fetch(`/api/projects/${projectId}/milestones/${id}`, { method: 'DELETE' })
    setMilestones(prev => prev.filter(m => m.id !== id))
  }

  const totalPaid     = milestones.filter(m => m.status === 'paid').reduce((s, m) => s + (m.amount ?? 0), 0)
  const totalPending  = milestones.filter(m => m.status !== 'paid').reduce((s, m) => s + (m.amount ?? 0), 0)
  const totalOverdue  = milestones.filter(m => m.status === 'overdue').reduce((s, m) => s + (m.amount ?? 0), 0)
  const currency = milestones[0]?.currency ?? 'GBP'

  const fieldStyle = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  }

  return (
    <div className="rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
      <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Payment Milestones</h3>
        {canEdit && (
          <button onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white"
            style={{ background: 'var(--accent)' }}>
            <Plus size={12} /> Add
          </button>
        )}
      </div>

      {/* Summary strip */}
      {milestones.length > 0 && (
        <div className="grid grid-cols-3 gap-3 px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <p className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>Paid</p>
            <p className="text-sm font-semibold" style={{ color: '#4ade80' }}>{fmt(totalPaid, currency)}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>Outstanding</p>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(totalPending, currency)}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>Overdue</p>
            <p className="text-sm font-semibold" style={{ color: totalOverdue > 0 ? '#f87171' : 'var(--text-muted)' }}>{fmt(totalOverdue, currency)}</p>
          </div>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <form onSubmit={add} className="px-5 py-4 border-b space-y-3" style={{ borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Label *</label>
              <input required value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Stage payment — mobilisation"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={fieldStyle} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Amount</label>
              <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={fieldStyle} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Currency</label>
              <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={fieldStyle}>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Due date</label>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={fieldStyle} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Invoice ref</label>
              <input value={form.invoice_ref} onChange={e => setForm(f => ({ ...f, invoice_ref: e.target.value }))}
                placeholder="INV-001" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={fieldStyle} />
            </div>
          </div>
          {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowAdd(false)}
              className="text-sm px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="text-sm px-4 py-1.5 rounded-lg text-white disabled:opacity-60" style={{ background: 'var(--accent)' }}>
              {saving ? 'Adding…' : 'Add milestone'}
            </button>
          </div>
        </form>
      )}

      {/* Milestone list */}
      {loading ? (
        <div className="px-5 py-6 text-sm text-center" style={{ color: 'var(--text-muted)' }}>Loading…</div>
      ) : milestones.length === 0 ? (
        <div className="px-5 py-6 text-sm text-center" style={{ color: 'var(--text-muted)' }}>No milestones yet</div>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {milestones.map(m => {
            const cfg = STATUS_CFG[m.status] ?? STATUS_CFG.pending
            const isOverdue = m.due_date && m.due_date < new Date().toISOString().split('T')[0] && m.status !== 'paid'
            return (
              <div key={m.id} className="px-5 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{m.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {m.due_date ? `Due ${m.due_date}` : 'No due date'}
                    {m.invoice_ref ? ` · ${m.invoice_ref}` : ''}
                    {isOverdue && <span style={{ color: '#f87171' }}> · OVERDUE</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(m.amount, m.currency)}</p>
                  <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{ background: cfg.bg, color: cfg.color }}>
                    {cfg.icon} {cfg.label}
                  </span>
                  {canEdit && m.status !== 'paid' && (
                    <button onClick={() => updateStatus(m.id, m.status === 'pending' ? 'invoiced' : 'paid')}
                      className="text-[10px] px-2 py-0.5 rounded-full border"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                      {m.status === 'pending' ? 'Mark invoiced' : 'Mark paid'}
                    </button>
                  )}
                  {canEdit && (
                    <button onClick={() => remove(m.id)} style={{ color: 'var(--text-muted)' }}>
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
