'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { WORK_ORDER_TYPES, PRIORITIES } from '@/lib/constants'
import type { Vessel, MaintenanceJob } from '@/lib/types'

interface Props {
  vessels: Vessel[]
  defaultVesselId?: string
}

export default function WorkOrderForm({ vessels, defaultVesselId }: Props) {
  const router = useRouter()
  const [vesselId, setVesselId] = useState(defaultVesselId ?? vessels[0]?.id ?? '')
  const [jobs, setJobs] = useState<MaintenanceJob[]>([])
  const [form, setForm] = useState({
    job_id: '',
    title: '',
    description: '',
    type: 'planned',
    status: 'open',
    planned_date: '',
    labor_cost: '',
    remarks: '',
    priority: 'medium',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!vesselId) return
    const supabase = createClient()
    supabase.from('maintenance_jobs').select('id,title').eq('vessel_id', vesselId).eq('status', 'active')
      .then(({ data }) => setJobs((data ?? []) as any))
  }, [vesselId])

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: existing } = await supabase
      .from('work_orders').select('id').eq('vessel_id', vesselId)
    const count = existing?.length ?? 0
    const wo_number = `WO-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`

    const { error: err } = await supabase.from('work_orders').insert({
      vessel_id: vesselId,
      job_id: form.job_id || null,
      wo_number,
      title: form.title,
      description: form.description || null,
      type: form.type,
      status: form.status,
      planned_date: form.planned_date || null,
      labor_cost: form.labor_cost ? parseFloat(form.labor_cost) : null,
      remarks: form.remarks || null,
    })

    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      router.push('/work-orders')
      router.refresh()
    }
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none'
  const inputStyle = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <div className="rounded-xl p-5 space-y-4"
           style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Vessel</label>
            <select value={vesselId} onChange={e => setVesselId(e.target.value)} className={inputCls} style={inputStyle}>
              {vessels.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Maintenance Job (optional)</label>
            <select value={form.job_id} onChange={e => set('job_id', e.target.value)} className={inputCls} style={inputStyle}>
              <option value="">— none —</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Title *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} required className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Type</label>
            <select value={form.type} onChange={e => set('type', e.target.value)} className={inputCls} style={inputStyle}>
              {WORK_ORDER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls} style={inputStyle}>
              {['draft','open','in_progress','completed','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Planned Date</label>
            <input type="date" value={form.planned_date} onChange={e => set('planned_date', e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Labour Cost (USD)</label>
            <input type="number" step="0.01" value={form.labor_cost} onChange={e => set('labor_cost', e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Remarks</label>
            <textarea value={form.remarks} onChange={e => set('remarks', e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} />
          </div>
        </div>
      </div>

      {error && <p className="text-sm" style={{ color: 'var(--critical)' }}>{error}</p>}

      <button type="submit" disabled={loading}
        className="px-6 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: 'var(--accent)' }}>
        {loading ? 'Creating…' : 'Create Work Order'}
      </button>
    </form>
  )
}
