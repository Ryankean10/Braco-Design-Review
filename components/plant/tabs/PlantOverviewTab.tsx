'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PlantItem } from '@/lib/types'

interface Props {
  item: PlantItem & { project?: any; site?: any; operator?: any }
  projects: { id: string; name: string }[]
  people: { id: string; name: string; role: string }[]
  canEdit: boolean
}

export default function PlantOverviewTab({ item, projects, people, canEdit }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: item.name,
    category: item.category,
    make: item.make ?? '',
    model: item.model ?? '',
    plant_ref: item.plant_ref ?? '',
    year: item.year?.toString() ?? '',
    status: item.status,
    project_id: item.project_id ?? '',
    operator_id: item.operator_id ?? '',
    supplier: item.supplier ?? '',
    hire_rate_daily: item.hire_rate_daily?.toString() ?? '',
    hire_rate_weekly: item.hire_rate_weekly?.toString() ?? '',
    on_hire_date: item.on_hire_date ?? '',
    expected_off_hire: item.expected_off_hire ?? '',
    notes: item.notes ?? '',
  })

  async function save() {
    setSaving(true)
    await fetch(`/api/plant/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setEditing(false)
    router.refresh()
  }

  const Field = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div>
      <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-sm" style={{ color: value ? 'var(--text-primary)' : 'var(--text-muted)' }}>{value || '—'}</p>
    </div>
  )

  const Input = ({ label, field, type = 'text', placeholder = '' }: { label: string; field: keyof typeof form; type?: string; placeholder?: string }) => (
    <div>
      <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <input
        type={type}
        value={form[field]}
        onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg text-sm border"
        style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
      />
    </div>
  )

  if (!editing) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          {canEdit && (
            <button onClick={() => setEditing(true)} className="text-sm px-4 py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              Edit
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          <Field label="Name" value={item.name} />
          <Field label="Category" value={item.category} />
          <Field label="Status" value={item.status.replace('_', ' ')} />
          <Field label="Make" value={item.make} />
          <Field label="Model" value={item.model} />
          <Field label="Year" value={item.year?.toString()} />
          <Field label="Plant Ref" value={item.plant_ref} />
          <Field label="Supplier" value={item.supplier} />
          <Field label="Day Rate" value={item.hire_rate_daily ? `£${item.hire_rate_daily}` : null} />
          <Field label="Week Rate" value={item.hire_rate_weekly ? `£${item.hire_rate_weekly}` : null} />
          <Field label="On Hire Date" value={item.on_hire_date ? new Date(item.on_hire_date).toLocaleDateString('en-GB') : null} />
          <Field label="Expected Off Hire" value={item.expected_off_hire ? new Date(item.expected_off_hire).toLocaleDateString('en-GB') : null} />
        </div>
        <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Assignment</p>
          <div className="grid grid-cols-2 gap-5">
            <Field label="Project" value={(item as any).project?.name} />
            <Field label="Operator" value={(item as any).operator?.name} />
          </div>
        </div>
        {item.notes && (
          <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Notes</p>
            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{item.notes}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Input label="Name" field="name" />
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Category</label>
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-sm border"
            style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
            {['excavator','dumper','telehandler','crane','roller','generator','lorry','scaffold','pump','other'].map(c =>
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            )}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Status</label>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-sm border"
            style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
            {['available','on_hire','breakdown','returned','sold'].map(s =>
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            )}
          </select>
        </div>
        <Input label="Make" field="make" placeholder="Caterpillar" />
        <Input label="Model" field="model" placeholder="320" />
        <Input label="Year" field="year" type="number" placeholder="2022" />
        <Input label="Plant Ref" field="plant_ref" placeholder="SPC-001" />
        <Input label="Supplier" field="supplier" placeholder="Hire company" />
        <Input label="Day Rate (£)" field="hire_rate_daily" type="number" />
        <Input label="Week Rate (£)" field="hire_rate_weekly" type="number" />
        <Input label="On Hire Date" field="on_hire_date" type="date" />
        <Input label="Expected Off Hire" field="expected_off_hire" type="date" />
      </div>

      <div className="border-t pt-4 grid grid-cols-2 gap-4" style={{ borderColor: 'var(--border)' }}>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Assign to Project</label>
          <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-sm border"
            style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
            <option value="">Unassigned</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Assign Operator</label>
          <select value={form.operator_id} onChange={e => setForm(f => ({ ...f, operator_id: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-sm border"
            style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
            <option value="">None</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Notes</label>
        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          rows={3} className="w-full px-3 py-2 rounded-lg text-sm border resize-none"
          style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          Cancel
        </button>
        <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
