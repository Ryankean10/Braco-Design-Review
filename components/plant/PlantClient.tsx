'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Map, Search, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import type { PlantItem } from '@/lib/types'

const PlantMap = dynamic(() => import('./PlantMap'), { ssr: false })

const CATEGORY_IMAGE: Record<string, string> = {
  excavator:   '/Plant/Excavator .png',
  dumper:      '/Plant/Dumper.png',
  telehandler: '/Plant/telehandler.png',
  crane:       '/Plant/crane.png',
  roller:      '/Plant/Roller.png',
  generator:   '/Plant/Generator.png',
  lorry:       '/Plant/Lorry.png',
  scaffold:    '/Plant/Scaffold.png',
  pump:        '/Plant/Pump.png',
}

const STATUS_COLOURS: Record<string, { bg: string; text: string; border: string }> = {
  available:  { bg: 'rgba(34,197,94,0.1)',  text: '#22c55e', border: 'rgba(34,197,94,0.3)' },
  on_hire:    { bg: 'rgba(59,130,246,0.1)', text: '#3b82f6', border: 'rgba(59,130,246,0.3)' },
  breakdown:  { bg: 'rgba(239,68,68,0.1)',  text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  returned:   { bg: 'rgba(100,116,139,0.1)',text: '#64748b', border: 'rgba(100,116,139,0.3)' },
  sold:       { bg: 'rgba(100,116,139,0.1)',text: '#64748b', border: 'rgba(100,116,139,0.3)' },
}

const CATEGORIES = ['excavator','dumper','telehandler','crane','roller','generator','lorry','scaffold','pump','other']

interface Project { id: string; name: string; location: string }
interface Site    { id: string; name: string }
interface Person  { id: string; name: string; role: string }

interface Props {
  plant: (PlantItem & { project?: { name: string; location: string } | null; site?: { name: string } | null; operator?: { name: string } | null })[]
  projects: Project[]
  sites: Site[]
  people: Person[]
  companyId: string
  canEdit: boolean
}

export default function PlantClient({ plant, projects, sites, people, companyId, canEdit }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [showMap, setShowMap] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    name: '', category: 'excavator', make: '', model: '', plant_ref: '',
    year: '', status: 'available', supplier: '',
    hire_rate_daily: '', hire_rate_weekly: '',
  })

  const filtered = plant.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false
    if (search && !`${p.name} ${p.make} ${p.model} ${p.plant_ref}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    const res = await fetch('/api/plant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, company_id: companyId }),
    })
    if (res.ok) {
      const { id } = await res.json()
      router.push(`/plant/${id}`)
    } else {
      setAdding(false)
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Plant Register</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{plant.length} item{plant.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMap(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', background: 'var(--bg-surface)' }}
          >
            <Map size={14} /> Plant Overview
          </button>
          {canEdit && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: 'var(--accent)' }}
            >
              <Plus size={14} /> Add Plant
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search plant..."
            className="pl-8 pr-3 py-1.5 rounded-lg text-sm border"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)', width: 200 }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm border"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
        >
          <option value="all">All statuses</option>
          <option value="available">Available</option>
          <option value="on_hire">On hire</option>
          <option value="breakdown">Breakdown</option>
          <option value="returned">Returned</option>
        </select>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm border"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
        >
          <option value="all">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'On Hire',    value: plant.filter(p => p.status === 'on_hire').length,   colour: '#3b82f6' },
          { label: 'Available',  value: plant.filter(p => p.status === 'available').length,  colour: '#22c55e' },
          { label: 'Breakdown',  value: plant.filter(p => p.status === 'breakdown').length,  colour: '#ef4444' },
          { label: 'Total',      value: plant.length,                                         colour: 'var(--accent)' },
        ].map(({ label, value, colour }) => (
          <div key={label} className="rounded-xl p-4 border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
            <p className="text-2xl font-bold" style={{ color: colour }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No plant items found</p>
          {canEdit && (
            <button onClick={() => setShowAdd(true)} className="text-sm px-4 py-2 rounded-lg text-white" style={{ background: 'var(--accent)' }}>
              Add first item
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(p => {
            const img = CATEGORY_IMAGE[p.category.toLowerCase()] ?? '/Plant/Default.png'
            const sc = STATUS_COLOURS[p.status] ?? STATUS_COLOURS.available
            return (
              <button
                key={p.id}
                onClick={() => router.push(`/plant/${p.id}`)}
                className="rounded-xl border p-4 text-left hover:opacity-80 transition-opacity"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <img src={img} alt={p.category} className="w-12 h-12 object-contain rounded-lg" style={{ background: 'var(--bg-elevated)' }} />
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize"
                    style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                    {p.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {[p.make, p.model].filter(Boolean).join(' ') || p.category}
                </p>
                {p.plant_ref && (
                  <p className="text-[10px] mt-1 font-mono" style={{ color: 'var(--text-muted)' }}>{p.plant_ref}</p>
                )}
                {p.project && (
                  <p className="text-[10px] mt-2 truncate" style={{ color: 'var(--accent)' }}>{p.project.name}</p>
                )}
                {p.operator && (
                  <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{p.operator.name}</p>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Map overlay */}
      {showMap && <PlantMap plant={plant} onClose={() => setShowMap(false)} />}

      {/* Add plant modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Add Plant Item</h2>
              <button onClick={() => setShowAdd(false)}><X size={16} style={{ color: 'var(--text-muted)' }} /></button>
            </div>
            <form onSubmit={handleAdd} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Name *</label>
                  <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" placeholder="e.g. Cat 320 Excavator"
                    style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                    <option value="available">Available</option>
                    <option value="on_hire">On Hire</option>
                    <option value="breakdown">Breakdown</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Make</label>
                  <input value={form.make} onChange={e => setForm(f => ({ ...f, make: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" placeholder="Caterpillar"
                    style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Model</label>
                  <input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" placeholder="320"
                    style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Plant Ref</label>
                  <input value={form.plant_ref} onChange={e => setForm(f => ({ ...f, plant_ref: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" placeholder="SPC-001"
                    style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Year</label>
                  <input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" placeholder="2022"
                    style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Day Rate (£)</label>
                  <input type="number" step="0.01" value={form.hire_rate_daily} onChange={e => setForm(f => ({ ...f, hire_rate_daily: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" placeholder="0.00"
                    style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Week Rate (£)</label>
                  <input type="number" step="0.01" value={form.hire_rate_weekly} onChange={e => setForm(f => ({ ...f, hire_rate_weekly: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" placeholder="0.00"
                    style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Supplier</label>
                  <input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" placeholder="Hire company name"
                    style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowAdd(false)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  Cancel
                </button>
                <button type="submit" disabled={adding}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: 'var(--accent)' }}>
                  {adding ? 'Adding...' : 'Add Plant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
