'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CLASS_SOCIETIES, VESSEL_TYPES, VESSEL_STATUSES } from '@/lib/constants'
import type { Vessel } from '@/lib/types'

interface Props {
  vessel?: Vessel
}

export default function VesselForm({ vessel }: Props) {
  const router = useRouter()
  const isEdit = !!vessel

  const [form, setForm] = useState({
    name: vessel?.name ?? '',
    imo_number: vessel?.imo_number ?? '',
    mmsi: vessel?.mmsi ?? '',
    call_sign: vessel?.call_sign ?? '',
    flag: vessel?.flag ?? '',
    port_of_registry: vessel?.port_of_registry ?? '',
    class_society: vessel?.class_society ?? 'None',
    class_notation: vessel?.class_notation ?? '',
    vessel_type: vessel?.vessel_type ?? 'Motor Yacht',
    gt: vessel?.gt?.toString() ?? '',
    loa_m: vessel?.loa_m?.toString() ?? '',
    beam_m: vessel?.beam_m?.toString() ?? '',
    max_draught_m: vessel?.max_draught_m?.toString() ?? '',
    year_built: vessel?.year_built?.toString() ?? '',
    place_of_build: vessel?.place_of_build ?? '',
    hull_material: vessel?.hull_material ?? '',
    main_engine_maker: vessel?.main_engine_maker ?? '',
    main_engine_model: vessel?.main_engine_model ?? '',
    owner: vessel?.owner ?? '',
    operator: vessel?.operator ?? '',
    manager: vessel?.manager ?? '',
    status: vessel?.status ?? 'active',
    notes: vessel?.notes ?? '',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const payload = {
      name: form.name,
      imo_number: form.imo_number || null,
      mmsi: form.mmsi || null,
      call_sign: form.call_sign || null,
      flag: form.flag,
      port_of_registry: form.port_of_registry || null,
      class_society: form.class_society || null,
      class_notation: form.class_notation || null,
      vessel_type: form.vessel_type,
      gt: form.gt ? parseFloat(form.gt) : null,
      loa_m: form.loa_m ? parseFloat(form.loa_m) : null,
      beam_m: form.beam_m ? parseFloat(form.beam_m) : null,
      max_draught_m: form.max_draught_m ? parseFloat(form.max_draught_m) : null,
      year_built: form.year_built ? parseInt(form.year_built) : null,
      place_of_build: form.place_of_build || null,
      hull_material: form.hull_material || null,
      main_engine_maker: form.main_engine_maker || null,
      main_engine_model: form.main_engine_model || null,
      owner: form.owner || null,
      operator: form.operator || null,
      manager: form.manager || null,
      status: form.status,
      notes: form.notes || null,
    }

    let err: string | null = null
    if (isEdit) {
      const { error: e } = await supabase.from('vessels').update(payload).eq('id', vessel!.id)
      err = e?.message ?? null
    } else {
      const { error: e } = await supabase.from('vessels').insert(payload)
      err = e?.message ?? null
    }

    if (err) {
      setError(err)
      setLoading(false)
    } else {
      router.push('/vessels')
      router.refresh()
    }
  }

  async function handleDelete() {
    if (!vessel) return
    setLoading(true)
    const supabase = createClient()
    await supabase.from('vessels').delete().eq('id', vessel.id)
    router.push('/vessels')
    router.refresh()
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none'
  const inputStyle = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  }
  const labelCls = 'block text-xs font-medium mb-1'
  const labelStyle = { color: 'var(--text-muted)' }

  function Field({ name, label, type = 'text', required }: { name: string; label: string; type?: string; required?: boolean }) {
    return (
      <div>
        <label className={labelCls} style={labelStyle}>{label}</label>
        <input type={type} value={(form as any)[name]} onChange={e => set(name, e.target.value)}
          required={required} className={inputCls} style={inputStyle} />
      </div>
    )
  }

  function Select({ name, label, options }: { name: string; label: string; options: readonly string[] }) {
    return (
      <div>
        <label className={labelCls} style={labelStyle}>{label}</label>
        <select value={(form as any)[name]} onChange={e => set(name, e.target.value)}
          className={inputCls} style={inputStyle}>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <section className="rounded-xl p-5 space-y-4"
               style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Identity</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field name="name" label="Vessel Name" required />
          <Select name="vessel_type" label="Type" options={VESSEL_TYPES} />
          <Field name="imo_number" label="IMO Number" />
          <Field name="mmsi" label="MMSI" />
          <Field name="call_sign" label="Call Sign" />
          <Field name="flag" label="Flag State" required />
          <Field name="port_of_registry" label="Port of Registry" />
          <Select name="status" label="Status" options={VESSEL_STATUSES} />
        </div>
      </section>

      <section className="rounded-xl p-5 space-y-4"
               style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Classification</h3>
        <div className="grid grid-cols-2 gap-4">
          <Select name="class_society" label="Class Society" options={CLASS_SOCIETIES} />
          <Field name="class_notation" label="Class Notation" />
        </div>
      </section>

      <section className="rounded-xl p-5 space-y-4"
               style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Dimensions & Build</h3>
        <div className="grid grid-cols-3 gap-4">
          <Field name="gt" label="GT" type="number" />
          <Field name="loa_m" label="LOA (m)" type="number" />
          <Field name="beam_m" label="Beam (m)" type="number" />
          <Field name="max_draught_m" label="Max Draught (m)" type="number" />
          <Field name="year_built" label="Year Built" type="number" />
          <Field name="place_of_build" label="Place of Build" />
          <Field name="hull_material" label="Hull Material" />
        </div>
      </section>

      <section className="rounded-xl p-5 space-y-4"
               style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Propulsion</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field name="main_engine_maker" label="Main Engine Maker" />
          <Field name="main_engine_model" label="Main Engine Model" />
        </div>
      </section>

      <section className="rounded-xl p-5 space-y-4"
               style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Ownership</h3>
        <div className="grid grid-cols-3 gap-4">
          <Field name="owner" label="Owner" />
          <Field name="operator" label="Operator" />
          <Field name="manager" label="Manager" />
        </div>
      </section>

      <section className="rounded-xl p-5 space-y-4"
               style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Notes</h3>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
          rows={3} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
          style={inputStyle} />
      </section>

      {error && <p className="text-sm" style={{ color: 'var(--critical)' }}>{error}</p>}

      <div className="flex items-center justify-between">
        <button type="submit" disabled={loading}
          className="px-6 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: 'var(--accent)' }}>
          {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Vessel'}
        </button>

        {isEdit && (
          confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Delete vessel and all data?</span>
              <button type="button" onClick={handleDelete}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: 'var(--critical)' }}>Confirm Delete</button>
              <button type="button" onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>Cancel</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ color: 'var(--critical)' }}>Delete Vessel</button>
          )
        )}
      </div>
    </form>
  )
}
