'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Company, Module } from '@/lib/types'
import { Building2, Plus, Check, X, ChevronDown, ChevronRight } from 'lucide-react'

// Top-level sidebar modules
const TOP_MODULES: { key: Module; label: string; subFeatures?: { key: string; label: string }[] }[] = [
  { key: 'projects', label: 'Projects' },
  {
    key: 'construction', label: 'Construction',
    subFeatures: [
      { key: 'construction.itp',         label: 'ITP (Inspection & Test Plan)' },
      { key: 'construction.civils',      label: 'Civils Works' },
      { key: 'construction.cable',       label: 'Cable Schedule' },
      { key: 'construction.timesheets',  label: 'Agency Timesheets' },
      { key: 'construction.programme',   label: 'Programme (P6)' },
    ],
  },
  { key: 'reference_library', label: 'Reference Library' },
  { key: 'planning',          label: 'Work Planner' },
  { key: 'team',              label: 'Team' },
  { key: 'plant',             label: 'Plant' },
  { key: 'documents',         label: 'Documents' },
  { key: 'reviews',           label: 'Reviews' },
  { key: 'procurement',       label: 'Procurement' },
  { key: 'tests',             label: 'Tests' },
  { key: 'assurance',         label: 'Assurance' },
]

function hasFeature(modules: string[], key: string) {
  return modules.includes(key)
}

function ModuleRow({
  mod,
  modules,
  onToggle,
}: {
  mod: typeof TOP_MODULES[0]
  modules: string[]
  onToggle: (key: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const on = hasFeature(modules, mod.key)
  const hasSubs = !!mod.subFeatures?.length

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onToggle(mod.key)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
          style={{
            borderColor: on ? 'var(--accent)' : 'var(--border)',
            background: on ? 'rgba(108,114,245,0.12)' : 'transparent',
            color: on ? 'var(--accent)' : 'var(--text-muted)',
          }}
        >
          {on ? <Check size={10} /> : <X size={10} />}
          {mod.label}
        </button>
        {hasSubs && on && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-0.5 text-[10px] transition-opacity hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
          >
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            {expanded ? 'hide' : 'features'}
          </button>
        )}
      </div>

      {hasSubs && on && expanded && (
        <div className="mt-2 ml-2 pl-3 border-l space-y-1.5" style={{ borderColor: 'var(--border)' }}>
          {mod.subFeatures!.map(sf => {
            const sfOn = hasFeature(modules, sf.key)
            return (
              <button
                key={sf.key}
                onClick={() => onToggle(sf.key)}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors"
                style={{
                  borderColor: sfOn ? 'var(--accent)' : 'var(--border)',
                  background: sfOn ? 'rgba(108,114,245,0.10)' : 'transparent',
                  color: sfOn ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                {sfOn ? <Check size={9} /> : <X size={9} />}
                {sf.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function CompaniesAdmin({ companies: initial }: { companies: Company[] }) {
  const [companies, setCompanies] = useState(initial)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [newModules, setNewModules] = useState<string[]>(['projects', 'documents', 'reviews', 'reference_library'])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  async function toggleFeature(company: Company, key: string) {
    const current = company.modules as string[]
    const updated = current.includes(key) ? current.filter(m => m !== key) : [...current, key]
    const { error } = await supabase
      .from('companies')
      .update({ modules: updated, updated_at: new Date().toISOString() })
      .eq('id', company.id)
    if (!error) {
      setCompanies(cs => cs.map(c => c.id === company.id ? { ...c, modules: updated as Module[] } : c))
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
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Manage tenants, modules and sub-features</p>
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
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{newSlug}.yacht-gitana.com</p>
              )}
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs mb-2 block" style={{ color: 'var(--text-muted)' }}>Modules</label>
            <div className="flex flex-wrap gap-2">
              {TOP_MODULES.map(mod => {
                const on = newModules.includes(mod.key)
                return (
                  <button
                    key={mod.key}
                    onClick={() => setNewModules(m => on ? m.filter(x => x !== mod.key) : [...m, mod.key])}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
                    style={{
                      borderColor: on ? 'var(--accent)' : 'var(--border)',
                      background: on ? 'rgba(108,114,245,0.12)' : 'transparent',
                      color: on ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                  >
                    {on && <Check size={10} />}
                    {mod.label}
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
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                style={{ background: company.accent_color ?? 'var(--accent)' }}
              >
                {company.name[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{company.name}</p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{company.slug}.yacht-gitana.com</p>
              </div>
            </div>

            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              Modules & features
            </p>
            <div className="flex flex-wrap gap-2 items-start">
              {TOP_MODULES.map(mod => (
                <ModuleRow
                  key={mod.key}
                  mod={mod}
                  modules={company.modules as string[]}
                  onToggle={key => toggleFeature(company, key)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
