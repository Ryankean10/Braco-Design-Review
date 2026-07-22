'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, TrendingUp, TrendingDown, X } from 'lucide-react'
import type { PlantFinancial } from '@/lib/types'

interface Props {
  financials: (PlantFinancial & { project?: { name: string } | null })[]
  plantId: string
  projects: { id: string; name: string }[]
  canEdit: boolean
}

const STATUS_COLOURS: Record<string, { bg: string; text: string }> = {
  outstanding: { bg: 'rgba(245,158,11,0.1)', text: '#f59e0b' },
  invoiced:    { bg: 'rgba(59,130,246,0.1)',  text: '#3b82f6' },
  paid:        { bg: 'rgba(34,197,94,0.1)',   text: '#22c55e' },
}

export default function PlantFinancialsTab({ financials, plantId, projects, canEdit }: Props) {
  const router = useRouter()
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    type: 'cost', description: '', amount: '', date: new Date().toISOString().split('T')[0],
    project_id: '', invoice_ref: '', status: 'outstanding',
  })

  const totalCost   = financials.filter(f => f.type === 'cost').reduce((s, f) => s + Number(f.amount), 0)
  const totalIncome = financials.filter(f => f.type === 'income').reduce((s, f) => s + Number(f.amount), 0)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch(`/api/plant/${plantId}/financials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setShowAdd(false)
    router.refresh()
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Cost',   value: totalCost,            icon: TrendingDown, colour: '#ef4444' },
          { label: 'Total Income', value: totalIncome,          icon: TrendingUp,   colour: '#22c55e' },
          { label: 'Net',          value: totalIncome - totalCost, icon: TrendingUp, colour: totalIncome - totalCost >= 0 ? '#22c55e' : '#ef4444' },
        ].map(({ label, value, icon: Icon, colour }) => (
          <div key={label} className="rounded-xl p-4 border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 mb-1">
              <Icon size={13} style={{ color: colour }} />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
            </div>
            <p className="text-xl font-bold" style={{ color: colour }}>
              {value < 0 ? '-' : ''}£{Math.abs(value).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
            </p>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Transactions</h3>
        {canEdit && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg text-white" style={{ background: 'var(--accent)' }}>
            <Plus size={13} /> Add
          </button>
        )}
      </div>

      {financials.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--text-muted)' }}>No financial records yet</p>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
                {['Date','Type','Description','Project','Invoice Ref','Amount','Status'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              {financials.map(f => {
                const sc = STATUS_COLOURS[f.status] ?? STATUS_COLOURS.outstanding
                return (
                  <tr key={f.id}>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(f.date).toLocaleDateString('en-GB')}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                        style={{ background: f.type === 'income' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: f.type === 'income' ? '#22c55e' : '#ef4444' }}>
                        {f.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-primary)' }}>{f.description || '—'}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{f.project?.name || '—'}</td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{f.invoice_ref || '—'}</td>
                    <td className="px-4 py-3 text-xs font-semibold" style={{ color: f.type === 'income' ? '#22c55e' : 'var(--text-primary)' }}>
                      {f.type === 'income' ? '+' : '-'}£{Number(f.amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full capitalize" style={{ background: sc.bg, color: sc.text }}>{f.status}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Add Financial Record</h2>
              <button onClick={() => setShowAdd(false)}><X size={16} style={{ color: 'var(--text-muted)' }} /></button>
            </div>
            <form onSubmit={save} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                    <option value="cost">Cost</option>
                    <option value="income">Income</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Description</label>
                  <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" placeholder="e.g. Weekly hire charge"
                    style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Amount (£) *</label>
                  <input required type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Invoice Ref</label>
                  <input value={form.invoice_ref} onChange={e => setForm(f => ({ ...f, invoice_ref: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Project</label>
                  <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                    <option value="">None</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                    <option value="outstanding">Outstanding</option>
                    <option value="invoiced">Invoiced</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>
                  {saving ? 'Saving...' : 'Add Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
