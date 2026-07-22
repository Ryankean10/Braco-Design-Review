'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Company, Module } from '@/lib/types'
import { Building2, Plus, Check, X } from 'lucide-react'

const ALL_MODULES: { key: Module; label: string }[] = [
  { key: 'projects',          label: 'Projects' },
  { key: 'documents',         label: 'Documents' },
  { key: 'reviews',           label: 'Reviews' },
  { key: 'reference_library', label: 'Reference Library' },
  { key: 'procurement',       label: 'Procurement' },
  { key: 'tests',             label: 'Tests' },
  { key: 'assurance',         label: 'Assurance' },
  { key: 'construction',      label: 'Construction' },
  { key: 'planning',          label: 'Work Planner' },
  { key: 'team',              label: 'Team' },
]

export default function CompaniesAdmin({ companies: initial }: { companies: Company[] }) {
  const [companies, setCompanies] = useState(initial)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [newModules, setNewModules] = useState<Module[]>(['projects', 'documents', 'reviews', 'reference_library'])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  async function toggleModule(company: Company, mod: Module) {
    const updated = company.modules.includes(mod)
      ? company.modules.filter(m => m !== mod)
      : [...company.modules, mod]

    const { error } = await supabase
      .from('companies')
      .update({ modules: updated, updated_at: new Date().toISOString() })
      .eq('id', company.id)

    if (!error) {
      setCompanies(cs => cs.map(c => c.id === company.id ? { ...c, modules: updated } : c))
    }
  }

  async function createCompany() {
    if (!newName.trim() || !newSlug.trim()) return
    setSaving(true)
    setError(null)

    const { data, error } = await supabase
      .from('companies')
      .insert({ name: newName.trim(), slug: newSlug.trim().toLowerCase(), modules: newModules })
      .select()
      .single()

    if (error) {
      setError(error.message)
    } else {
      setCompanies(cs => [...cs, data])
      setCreating(false)
      setNewName('')
      setNewSlug('')
      setNewModules(['projects', 'documents', 'reviews', 'reference_library'])
    }
    setSaving(false)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 size={22} style={{ color: 'var(--accent)' }} />
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Companies</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Manage tenants and enabled modules</p>
          </div>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: 'var(--accent)' }}
        >
          <Plus size={15} />
          New company
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="rounded-xl border p-4 mb-6" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>New company</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Company name</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Acme Energy Ltd"
                className="w-full px-3 py-2 rounded-lg text-sm border"
                style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Slug (subdomain)</label>
              <input
                value={newSlug}
                onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="acme"
                className="w-full px-3 py-2 rounded-lg text-sm border"
                style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
              {newSlug && (
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{newSlug}.gridgate.app</p>
              )}
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs mb-2 block" style={{ color: 'var(--text-muted)' }}>Modules</label>
            <div className="flex flex-wrap gap-2">
              {ALL_MODULES.map(({ key, label }) => {
                const on = newModules.includes(key)
                return (
                  <button
                    key={key}
                    onClick={() => setNewModules(m => on ? m.filter(x => x !== key) : [...m, key])}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
                    style={{
                      borderColor: on ? 'var(--accent)' : 'var(--border)',
                      background: on ? 'rgba(108,114,245,0.12)' : 'transparent',
                      color: on ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                  >
                    {on && <Check size={10} />}
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
          {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={createCompany}
              disabled={saving || !newName || !newSlug}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ background: 'var(--accent)' }}
            >
              {saving ? 'Creating…' : 'Create'}
            </button>
            <button
              onClick={() => setCreating(false)}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ color: 'var(--text-muted)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Company list */}
      <div className="space-y-4">
        {companies.map(company => (
          <div key={company.id} className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                style={{ background: 'var(--accent)' }}
              >
                {company.name[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{company.name}</p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{company.slug}.gridgate.app</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_MODULES.map(({ key, label }) => {
                const on = company.modules.includes(key)
                return (
                  <button
                    key={key}
                    onClick={() => toggleModule(company, key)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
                    style={{
                      borderColor: on ? 'var(--accent)' : 'var(--border)',
                      background: on ? 'rgba(108,114,245,0.12)' : 'transparent',
                      color: on ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                  >
                    {on ? <Check size={10} /> : <X size={10} />}
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
