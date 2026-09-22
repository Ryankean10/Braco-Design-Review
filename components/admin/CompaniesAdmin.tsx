'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Company, Module } from '@/lib/types'
import { Building2, Plus, Check, X, ArrowLeft, ChevronDown, ChevronRight, Palette, Save } from 'lucide-react'

const MODULE_GROUPS: {
  label: string
  modules: { key: string; label: string; subFeatures?: { key: string; label: string }[] }[]
}[] = [
  {
    label: 'Projects',
    modules: [
      {
        key: 'projects', label: 'Projects',
        subFeatures: [
          { key: 'projects.documents',    label: 'Document Library' },
          { key: 'projects.assurance',    label: 'Assurance (ITP & QCS)' },
          { key: 'projects.reviews',      label: 'AI Reviews & Findings' },
          { key: 'projects.procurement',  label: 'Procurement Register' },
          { key: 'projects.tests',        label: 'Test Register' },
          { key: 'projects.er',           label: "Employer's Requirements" },
          { key: 'projects.references',   label: 'Standards & References' },
          { key: 'projects.work_planner', label: 'Work Planner' },
          { key: 'projects.comments',     label: 'Client Comments' },
          { key: 'projects.rfi_tq',       label: 'RFI / TQ Register' },
        ],
      },
    ],
  },
  {
    label: 'Construction',
    modules: [
      {
        key: 'construction', label: 'Construction',
        subFeatures: [
          { key: 'construction.itp',        label: 'ITP (Inspection & Test Plan)' },
          { key: 'construction.civils',     label: 'Civils Works' },
          { key: 'construction.cable',      label: 'Cable Schedule' },
          { key: 'construction.timesheets', label: 'Timesheets' },
          { key: 'construction.programme',  label: 'Programme (P6)' },
          { key: 'construction.rfi_tq',     label: 'RFI / TQ Register' },
        ],
      },
      { key: 'planning', label: 'Work Planner' },
    ],
  },
  {
    label: 'Resources',
    modules: [
      { key: 'team',       label: 'Team' },
      { key: 'plant',      label: 'Plant' },
      { key: 'estimating', label: 'Estimating' },
    ],
  },
]

const ALL_TOP_MODULES = MODULE_GROUPS.flatMap(g => g.modules.map(m => ({ key: m.key as Module, label: m.label })))

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none"
      style={{ background: on ? 'var(--accent)' : '#334155' }}
    >
      <span
        className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? 'translateX(16px)' : 'translateX(0)' }}
      />
    </button>
  )
}

function ModuleGroup({
  group,
  modules,
  onToggle,
}: {
  group: typeof MODULE_GROUPS[0]
  modules: string[]
  onToggle: (key: string) => void
}) {
  const [openSubs, setOpenSubs] = useState<string | null>(null)

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-base)' }}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
        {group.label}
      </p>
      <div className="space-y-3">
        {group.modules.map(mod => {
          const on = modules.includes(mod.key)
          const hasSubs = !!mod.subFeatures?.length
          const subsOpen = openSubs === mod.key

          return (
            <div key={mod.key}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Toggle on={on} onClick={() => onToggle(mod.key)} />
                  <span className="text-sm truncate" style={{ color: on ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {mod.label}
                  </span>
                </div>
                {hasSubs && on && (
                  <button
                    onClick={() => setOpenSubs(subsOpen ? null : mod.key)}
                    className="flex items-center gap-1 text-xs shrink-0 hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {subsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    Sub-features
                  </button>
                )}
              </div>

              {hasSubs && on && subsOpen && (
                <div className="mt-3 ml-5 pl-3 border-l space-y-2.5" style={{ borderColor: 'var(--border)' }}>
                  {mod.subFeatures!.map(sf => {
                    const sfOn = modules.includes(sf.key)
                    return (
                      <div key={sf.key} className="flex items-center justify-between gap-3">
                        <span className="text-xs" style={{ color: sfOn ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {sf.label}
                        </span>
                        <Toggle on={sfOn} onClick={() => onToggle(sf.key)} />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CompanyDetail({
  company,
  onBack,
  onUpdate,
}: {
  company: Company
  onBack: () => void
  onUpdate: (updated: Company) => void
}) {
  const supabase = createClient()
  const modules = company.modules as string[]

  // Branding edit state
  const [brandName, setBrandName]         = useState(company.name)
  const [brandTagline, setBrandTagline]   = useState(company.tagline ?? '')
  const [brandAccent, setBrandAccent]     = useState(company.accent_color ?? '#6c72f5')
  const [brandLogoUrl, setBrandLogoUrl]   = useState(company.logo_url ?? '')
  const [brandLoginBg, setBrandLoginBg]   = useState<'dark' | 'light'>(company.login_bg ?? 'dark')
  const [brandSaving, setBrandSaving]     = useState(false)
  const [brandError, setBrandError]       = useState<string | null>(null)
  const [brandSaved, setBrandSaved]       = useState(false)

  async function toggle(key: string) {
    const updated = modules.includes(key) ? modules.filter(m => m !== key) : [...modules, key]
    const { error } = await supabase
      .from('companies')
      .update({ modules: updated, updated_at: new Date().toISOString() })
      .eq('id', company.id)
    if (!error) onUpdate({ ...company, modules: updated as Module[] })
  }

  async function saveBranding() {
    setBrandSaving(true)
    setBrandError(null)
    setBrandSaved(false)
    const { error } = await supabase
      .from('companies')
      .update({
        name: brandName.trim(),
        tagline: brandTagline.trim() || null,
        accent_color: brandAccent,
        logo_url: brandLogoUrl.trim() || null,
        login_bg: brandLoginBg,
        updated_at: new Date().toISOString(),
      })
      .eq('id', company.id)
    if (error) {
      setBrandError(error.message)
    } else {
      onUpdate({ ...company, name: brandName.trim(), tagline: brandTagline.trim() || null, accent_color: brandAccent, logo_url: brandLogoUrl.trim() || null, login_bg: brandLoginBg })
      setBrandSaved(true)
      setTimeout(() => setBrandSaved(false), 2000)
    }
    setBrandSaving(false)
  }

  const enabledCount = MODULE_GROUPS.flatMap(g => g.modules).filter(m => modules.includes(m.key)).length
  const totalCount   = MODULE_GROUPS.flatMap(g => g.modules).length

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft size={15} />
          Companies
        </button>
        <span style={{ color: 'var(--border)' }}>/</span>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
          style={{ background: brandAccent }}
        >
          {brandName[0]?.toUpperCase() ?? 'C'}
        </div>
        <div>
          <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{brandName}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{company.slug}.yacht-gitana.com · {enabledCount}/{totalCount} modules enabled</p>
        </div>
      </div>

      {/* Module groups */}
      <div className="grid grid-cols-2 gap-4 items-start mb-6">
        {MODULE_GROUPS.map(group => (
          <ModuleGroup key={group.label} group={group} modules={modules} onToggle={toggle} />
        ))}
      </div>

      {/* Branding section */}
      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Palette size={15} style={{ color: 'var(--accent)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Branding & Identity</p>
        </div>

        {/* Live preview */}
        <div className="rounded-lg p-3 mb-4 flex items-center gap-3"
          style={{ background: brandLoginBg === 'dark' ? '#1e293b' : '#f8fafc', border: '1px solid var(--border)' }}>
          {brandLogoUrl ? (
            <img src={brandLogoUrl} alt="Logo" className="h-8 object-contain" />
          ) : (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ background: brandAccent }}>
              {brandName[0]?.toUpperCase() ?? 'C'}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold" style={{ color: brandLoginBg === 'dark' ? '#f1f5f9' : '#0f172a' }}>{brandName || 'Company Name'}</p>
            {brandTagline && <p className="text-[10px]" style={{ color: brandLoginBg === 'dark' ? '#94a3b8' : '#64748b' }}>{brandTagline}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Name */}
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Company name</label>
            <input value={brandName} onChange={e => setBrandName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm border"
              style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          </div>
          {/* Tagline */}
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Tagline</label>
            <input value={brandTagline} onChange={e => setBrandTagline(e.target.value)}
              placeholder="High Voltage Specialists"
              className="w-full px-3 py-2 rounded-lg text-sm border"
              style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          </div>
          {/* Accent colour */}
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Accent colour</label>
            <div className="flex items-center gap-2">
              <input type="color" value={brandAccent} onChange={e => setBrandAccent(e.target.value)}
                className="w-10 h-9 rounded cursor-pointer border-0 p-0.5"
                style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }} />
              <input value={brandAccent} onChange={e => setBrandAccent(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg text-sm border font-mono"
                style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            </div>
          </div>
          {/* Logo URL */}
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Logo URL</label>
            <input value={brandLogoUrl} onChange={e => setBrandLogoUrl(e.target.value)}
              placeholder="https://…/logo.png"
              className="w-full px-3 py-2 rounded-lg text-sm border"
              style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          </div>
        </div>

        {/* Login theme */}
        <div className="mb-4">
          <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Login theme</label>
          <div className="flex gap-2">
            {(['dark', 'light'] as const).map(t => (
              <button key={t} onClick={() => setBrandLoginBg(t)}
                className="px-4 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                style={{
                  borderColor: brandLoginBg === t ? brandAccent : 'var(--border)',
                  background: brandLoginBg === t ? `${brandAccent}22` : 'transparent',
                  color: brandLoginBg === t ? brandAccent : 'var(--text-muted)',
                }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {brandError && <p className="text-xs text-red-500 mb-3">{brandError}</p>}

        <button onClick={saveBranding} disabled={brandSaving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style={{ background: brandSaved ? '#4ade80' : brandAccent, color: brandSaved ? '#000' : '#fff' }}>
          {brandSaved ? <><Check size={13} /> Saved</> : brandSaving ? 'Saving…' : <><Save size={13} /> Save branding</>}
        </button>
      </div>
    </div>
  )
}

export default function CompaniesAdmin({ companies: initial }: { companies: Company[] }) {
  const [companies, setCompanies] = useState(initial)
  const [selected, setSelected] = useState<Company | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [newTagline, setNewTagline] = useState('')
  const [newAccentColor, setNewAccentColor] = useState('#6c72f5')
  const [newLogoUrl, setNewLogoUrl] = useState('')
  const [newLoginBg, setNewLoginBg] = useState<'dark' | 'light'>('dark')
  const [newModules, setNewModules] = useState<Module[]>(['projects', 'documents', 'reviews', 'reference_library'])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  function handleUpdate(updated: Company) {
    setCompanies(cs => cs.map(c => c.id === updated.id ? updated : c))
    setSelected(updated)
  }

  async function createCompany() {
    if (!newName.trim() || !newSlug.trim()) return
    setSaving(true)
    setError(null)
    const { data, error } = await supabase
      .from('companies')
      .insert({
        name: newName.trim(),
        slug: newSlug.trim().toLowerCase(),
        modules: newModules,
        tagline: newTagline.trim() || null,
        accent_color: newAccentColor,
        logo_url: newLogoUrl.trim() || null,
        login_bg: newLoginBg,
      })
      .select()
      .single()
    if (error) {
      setError(error.message)
    } else {
      // Auto-appoint Safet Consultancy admin to every new company
      fetch('/api/admin/invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@safetconsultancy.co.uk',
          role: 'superadmin',
          full_name: 'Safet Admin',
          company_id: data.id,
        }),
      })
      setCompanies(cs => [...cs, data])
      setCreating(false)
      setNewName('')
      setNewSlug('')
      setNewTagline('')
      setNewAccentColor('#6c72f5')
      setNewLogoUrl('')
      setNewLoginBg('dark')
      setNewModules(['projects', 'documents', 'reviews', 'reference_library'])
    }
    setSaving(false)
  }

  if (selected) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <CompanyDetail
          company={selected}
          onBack={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 size={22} style={{ color: 'var(--accent)' }} />
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Companies</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Click a company to manage its modules</p>
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
              {newSlug && <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{newSlug}.yacht-gitana.com</p>}
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Tagline</label>
              <input
                value={newTagline}
                onChange={e => setNewTagline(e.target.value)}
                placeholder="High Voltage Specialists"
                className="w-full px-3 py-2 rounded-lg text-sm border"
                style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Accent colour</label>
              <div className="flex items-center gap-2">
                <input type="color" value={newAccentColor} onChange={e => setNewAccentColor(e.target.value)}
                  className="w-10 h-9 rounded cursor-pointer p-0.5"
                  style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }} />
                <input value={newAccentColor} onChange={e => setNewAccentColor(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg text-sm border font-mono"
                  style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Logo URL</label>
              <input
                value={newLogoUrl}
                onChange={e => setNewLogoUrl(e.target.value)}
                placeholder="https://…/logo.png"
                className="w-full px-3 py-2 rounded-lg text-sm border"
                style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Login theme</label>
              <div className="flex gap-2">
                {(['dark', 'light'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setNewLoginBg(t)}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                    style={{
                      borderColor: newLoginBg === t ? newAccentColor : 'var(--border)',
                      background: newLoginBg === t ? `${newAccentColor}22` : 'transparent',
                      color: newLoginBg === t ? newAccentColor : 'var(--text-muted)',
                    }}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs mb-2 block" style={{ color: 'var(--text-muted)' }}>Initial modules</label>
            <div className="flex flex-wrap gap-2">
              {ALL_TOP_MODULES.map(({ key, label }) => {
                const on = newModules.includes(key)
                return (
                  <button key={key}
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
            <button onClick={createCompany} disabled={saving || !newName || !newSlug}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ background: 'var(--accent)' }}>
              {saving ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => setCreating(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-muted)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Company cards */}
      <div className="grid grid-cols-2 gap-4">
        {companies.map(company => {
          const mods = company.modules as string[]
          const enabledCount = MODULE_GROUPS.flatMap(g => g.modules).filter(m => mods.includes(m.key)).length
          const totalCount   = MODULE_GROUPS.flatMap(g => g.modules).length
          return (
            <button
              key={company.id}
              onClick={() => setSelected(company)}
              className="rounded-xl border p-4 text-left transition-all hover:border-accent group"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ background: company.accent_color ?? 'var(--accent)' }}
                >
                  {company.name[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{company.name}</p>
                  <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{company.slug}.yacht-gitana.com</p>
                </div>
                <ChevronRight size={14} className="ml-auto shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--accent)' }} />
              </div>

              {/* Module pills preview */}
              <div className="flex flex-wrap gap-1.5">
                {MODULE_GROUPS.flatMap(g => g.modules).map(mod => {
                  const on = mods.includes(mod.key)
                  return (
                    <span key={mod.key}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{
                        background: on ? 'rgba(108,114,245,0.12)' : 'rgba(100,116,139,0.08)',
                        color: on ? 'var(--accent)' : 'var(--text-muted)',
                      }}
                    >
                      {mod.label}
                    </span>
                  )
                })}
              </div>

              <p className="text-[10px] mt-2.5" style={{ color: 'var(--text-muted)' }}>
                {enabledCount} of {totalCount} modules enabled
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
