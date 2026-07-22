'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import type { PlantCertificate } from '@/lib/types'

const CERT_TYPES = ['LOLER', 'MOT', 'Service', 'Insurance', 'Thorough Examination', 'PUWER', 'Other']

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function ExpiryBadge({ expiry }: { expiry: string }) {
  const days = daysUntil(expiry)
  if (days < 0)  return <span className="flex items-center gap-1 text-xs text-red-400"><AlertTriangle size={11} /> Expired</span>
  if (days <= 30) return <span className="flex items-center gap-1 text-xs text-amber-400"><Clock size={11} /> {days}d</span>
  return <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle size={11} /> {days}d</span>
}

interface Props {
  certificates: PlantCertificate[]
  plantId: string
  companyId: string
  canEdit: boolean
}

export default function PlantCertificatesTab({ certificates, plantId, companyId, canEdit }: Props) {
  const router = useRouter()
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    type: 'LOLER', reference: '', issued_date: '', expiry_date: '', issued_by: '', notes: '',
  })

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch(`/api/plant/${plantId}/certificates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, company_id: companyId }),
    })
    setSaving(false)
    setShowAdd(false)
    router.refresh()
  }

  const sorted = [...certificates].sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime())

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Certificates & Inspections
        </h3>
        {canEdit && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg text-white" style={{ background: 'var(--accent)' }}>
            <Plus size={13} /> Add
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--text-muted)' }}>No certificates recorded yet</p>
      ) : (
        <div className="space-y-2">
          {sorted.map(c => {
            const days = daysUntil(c.expiry_date)
            const urgent = days <= 0 ? 'rgba(239,68,68,0.08)' : days <= 30 ? 'rgba(245,158,11,0.08)' : 'var(--bg-surface)'
            const border = days <= 0 ? 'rgba(239,68,68,0.3)' : days <= 30 ? 'rgba(245,158,11,0.3)' : 'var(--border)'
            return (
              <div key={c.id} className="rounded-xl border px-4 py-3 flex items-center gap-4" style={{ background: urgent, borderColor: border }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{c.type}</p>
                    {c.reference && <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{c.reference}</span>}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Expires {new Date(c.expiry_date).toLocaleDateString('en-GB')}
                    {c.issued_by ? ` · ${c.issued_by}` : ''}
                    {c.issued_date ? ` · Issued ${new Date(c.issued_date).toLocaleDateString('en-GB')}` : ''}
                  </p>
                  {c.notes && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{c.notes}</p>}
                </div>
                <ExpiryBadge expiry={c.expiry_date} />
                {c.file_url && (
                  <a href={c.file_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs px-2 py-1 rounded border hover:opacity-80"
                    style={{ borderColor: 'var(--border)', color: 'var(--accent)' }}>
                    View
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Add Certificate</h2>
              <button onClick={() => setShowAdd(false)}><X size={16} style={{ color: 'var(--text-muted)' }} /></button>
            </div>
            <form onSubmit={save} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Certificate Type *</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                    {CERT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Reference</label>
                  <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" placeholder="Cert number"
                    style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Issued By</label>
                  <input value={form.issued_by} onChange={e => setForm(f => ({ ...f, issued_by: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" placeholder="Inspector / company"
                    style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Issued Date</label>
                  <input type="date" value={form.issued_date} onChange={e => setForm(f => ({ ...f, issued_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Expiry Date *</label>
                  <input required type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Notes</label>
                  <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>
                  {saving ? 'Saving...' : 'Add Certificate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
