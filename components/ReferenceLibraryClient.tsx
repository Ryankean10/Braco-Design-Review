'use client'

import { useState } from 'react'
import { BookOpen, Shield, AlertTriangle, Zap, FileText, FileCheck, ChevronDown, ChevronRight, ExternalLink, Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Standard, HsReference, LessonLearned, OperatorRule, ReferenceTemplate, StandardCategory, StandardStatus } from '@/lib/types'
import LessonsLearnedTable from '@/components/LessonsLearned'
import StandardDocUpload from '@/components/StandardDocUpload'
import TemplatesLibrary from '@/components/TemplatesLibrary'
import ComplianceTab, { type ComplianceDocument } from '@/components/ComplianceTab'

type Tab = 'standards' | 'hs' | 'lessons' | 'operators' | 'templates' | 'compliance'

interface StandardWithClauses extends Standard {
  standard_clauses: Array<{
    id: string
    clause_ref: string
    heading: string
    body: string
    review_lenses: string[]
    severity_hint: string | null
  }>
  doc_storage_path?: string | null
  doc_file_name?: string | null
}

interface Props {
  standards: StandardWithClauses[]
  hsRefs: HsReference[]
  lessons: LessonLearned[]
  opRules: OperatorRule[]
  templates: ReferenceTemplate[]
  companyId: string | null
  isAdmin: boolean
  isSuperAdmin: boolean
  canManageTemplates: boolean
  complianceDocs: ComplianceDocument[]
  canEditCompliance: boolean
  canEditRef: boolean
}

const severityColour: Record<string, string> = {
  Critical: 'var(--critical)',
  Major: 'var(--major)',
  Minor: 'var(--minor)',
  Observation: 'var(--observation)',
}

const categoryBadgeColour: Record<string, string> = {
  'Grid Connection': '#1d4ed8',
  'Protection': '#7c3aed',
  'Electrical': '#0891b2',
  'Fire & BESS Safety': '#dc2626',
  'Civils & Geotechnical': '#92400e',
  'Temporary Works': '#b45309',
  'CDM / H&S': '#065f46',
  'Other': '#374151',
  'Safety': '#be185d',
}

const STANDARD_CATEGORIES: StandardCategory[] = [
  'Grid Connection','Protection','Electrical','Fire & BESS Safety',
  'Civils & Geotechnical','Temporary Works','CDM / H&S','Safety','Other',
]
const STANDARD_STATUSES: StandardStatus[] = ['In Force','Draft','Withdrawn','Superseded']
const HS_CATEGORIES = ['CDM / H&S','Safety','Electrical','Grid Connection','Civils & Geotechnical','Fire & BESS Safety','Other']

const fieldStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  borderRadius: '0.5rem',
  padding: '0.5rem 0.75rem',
  fontSize: '0.75rem',
  width: '100%',
  outline: 'none',
} as React.CSSProperties

function Badge({ label, colour }: { label: string; colour: string }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white" style={{ background: colour }}>
      {label}
    </span>
  )
}

function SeverityChip({ sev }: { sev: string | null }) {
  if (!sev) return null
  return (
    <span className="text-xs px-1.5 py-0.5 rounded font-medium text-white" style={{ background: severityColour[sev] ?? '#6b7280' }}>
      {sev}
    </span>
  )
}

// ─── Standard form ────────────────────────────────────────────────────────────

const emptyStdForm = {
  ref: '',
  title: '',
  category: 'Electrical' as StandardCategory,
  status: 'In Force' as StandardStatus,
  body: '',
  effective_date: '',
  source_url: '',
}
type StdFormState = typeof emptyStdForm

function StandardForm({ initial, onSave, onCancel, saving }: {
  initial: StdFormState
  onSave: (f: StdFormState) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState(initial)
  const set = (k: keyof StdFormState, v: string) => setForm(f => ({ ...f, [k]: v }))
  const valid = form.ref.trim() && form.title.trim()

  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ background: 'var(--bg-surface)', borderColor: 'var(--accent)' }}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Ref *</label>
          <input style={fieldStyle} value={form.ref} onChange={e => set('ref', e.target.value)} placeholder="e.g. BS 7671" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Status</label>
          <select style={fieldStyle} value={form.status} onChange={e => set('status', e.target.value as StandardStatus)}>
            {STANDARD_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Title *</label>
          <input style={fieldStyle} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Full title of the standard" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Category</label>
          <select style={fieldStyle} value={form.category} onChange={e => set('category', e.target.value as StandardCategory)}>
            {STANDARD_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Effective date</label>
          <input type="date" style={fieldStyle} value={form.effective_date} onChange={e => set('effective_date', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Description / scope</label>
          <textarea style={{ ...fieldStyle, minHeight: 64, resize: 'vertical' }} value={form.body} onChange={e => set('body', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Source URL</label>
          <input style={fieldStyle} value={form.source_url} onChange={e => set('source_url', e.target.value)} placeholder="https://…" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border"
          style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
          <X size={12} /> Cancel
        </button>
        <button type="button" onClick={() => valid && onSave(form)}
          disabled={saving || !valid}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium text-white disabled:opacity-50"
          style={{ background: 'var(--accent)' }}>
          <Check size={12} /> {saving ? 'Saving…' : 'Save standard'}
        </button>
      </div>
    </div>
  )
}

// ─── H&S form ─────────────────────────────────────────────────────────────────

const emptyHsForm = { ref: '', title: '', category: 'CDM / H&S', duty_holder: '', body: '', source_url: '' }
type HsFormState = typeof emptyHsForm

function HsForm({ initial, onSave, onCancel, saving }: {
  initial: HsFormState
  onSave: (f: HsFormState) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState(initial)
  const set = (k: keyof HsFormState, v: string) => setForm(f => ({ ...f, [k]: v }))
  const valid = form.ref.trim() && form.title.trim()

  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ background: 'var(--bg-surface)', borderColor: 'var(--accent)' }}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Ref *</label>
          <input style={fieldStyle} value={form.ref} onChange={e => set('ref', e.target.value)} placeholder="e.g. CDM 2015" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Category</label>
          <select style={fieldStyle} value={form.category} onChange={e => set('category', e.target.value)}>
            {HS_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Title *</label>
          <input style={fieldStyle} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Full title / name" />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Duty holder</label>
          <input style={fieldStyle} value={form.duty_holder} onChange={e => set('duty_holder', e.target.value)} placeholder="e.g. Principal Contractor" />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Description / requirements</label>
          <textarea style={{ ...fieldStyle, minHeight: 64, resize: 'vertical' }} value={form.body} onChange={e => set('body', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Source URL</label>
          <input style={fieldStyle} value={form.source_url} onChange={e => set('source_url', e.target.value)} placeholder="https://…" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border"
          style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
          <X size={12} /> Cancel
        </button>
        <button type="button" onClick={() => valid && onSave(form)}
          disabled={saving || !valid}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium text-white disabled:opacity-50"
          style={{ background: 'var(--accent)' }}>
          <Check size={12} /> {saving ? 'Saving…' : 'Save reference'}
        </button>
      </div>
    </div>
  )
}

// ─── Row components ───────────────────────────────────────────────────────────

function StandardRow({ std, canEdit, onEdit, onDelete }: {
  std: StandardWithClauses
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:opacity-90 transition-opacity"
        style={{ background: 'var(--bg-surface)' }}
      >
        <span className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-sm font-semibold font-mono" style={{ color: 'var(--accent)' }}>{std.ref}</span>
            <Badge label={std.category} colour={categoryBadgeColour[std.category] ?? '#374151'} />
            <Badge
              label={std.status}
              colour={std.status === 'In Force' ? '#166534' : std.status === 'Withdrawn' ? '#7f1d1d' : '#854d0e'}
            />
            {std.standard_clauses?.length > 0 && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{std.standard_clauses.length} clause{std.standard_clauses.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{std.title}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{std.body}{std.effective_date ? ` · Effective ${std.effective_date}` : ''}</p>
        </div>
        {std.source_url && (
          <a href={std.source_url} target="_blank" rel="noopener noreferrer"
            className="flex-shrink-0" style={{ color: 'var(--text-muted)' }}
            onClick={e => e.stopPropagation()}>
            <ExternalLink size={13} />
          </a>
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3" style={{ background: 'var(--bg-elevated)' }}>
          {canEdit && (
            <div className="flex gap-2 pt-3" onClick={e => e.stopPropagation()}>
              <button onClick={onEdit}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border"
                style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                <Pencil size={11} /> Edit
              </button>
              <button onClick={onDelete}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border"
                style={{ color: 'var(--critical)', borderColor: 'var(--critical)' }}>
                <Trash2 size={11} /> Delete
              </button>
            </div>
          )}
          {std.summary && (
            <p className="text-xs pt-1" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{std.summary}</p>
          )}
          <StandardDocUpload
            standardId={std.id}
            docStoragePath={std.doc_storage_path ?? null}
            docFileName={std.doc_file_name ?? null}
            isAdmin={canEdit}
            aiAnalysedAt={(std as any).ai_analysed_at ?? null}
            aiSummary={(std as any).ai_summary ?? null}
          />
          {std.standard_clauses?.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Key Clauses</p>
              {std.standard_clauses.map(cl => (
                <div key={cl.id} className="rounded-lg px-3 py-2.5 border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs font-mono font-semibold" style={{ color: 'var(--accent)' }}>{cl.clause_ref}</span>
                    <SeverityChip sev={cl.severity_hint} />
                    {cl.review_lenses?.map(l => (
                      <span key={l} className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{l}</span>
                    ))}
                  </div>
                  <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-primary)' }}>{cl.heading}</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{cl.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function HsRow({ hs, canEdit, onEdit, onDelete }: {
  hs: HsReference
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:opacity-90 transition-opacity"
        style={{ background: 'var(--bg-surface)' }}
      >
        <span className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-mono font-semibold" style={{ color: 'var(--accent)' }}>{hs.ref}</span>
            <Badge label={hs.category} colour={categoryBadgeColour[hs.category] ?? '#374151'} />
          </div>
          <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{hs.title}</p>
          {hs.duty_holder && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Duty holder: {hs.duty_holder}</p>
          )}
        </div>
        {hs.source_url && (
          <a href={hs.source_url} target="_blank" rel="noopener noreferrer"
            className="flex-shrink-0" style={{ color: 'var(--text-muted)' }}
            onClick={e => e.stopPropagation()}>
            <ExternalLink size={13} />
          </a>
        )}
      </button>
      {open && (
        <div className="px-4 py-3 space-y-2" style={{ background: 'var(--bg-elevated)' }}>
          {canEdit && (
            <div className="flex gap-2 pb-1" onClick={e => e.stopPropagation()}>
              <button onClick={onEdit}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border"
                style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                <Pencil size={11} /> Edit
              </button>
              <button onClick={onDelete}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border"
                style={{ color: 'var(--critical)', borderColor: 'var(--critical)' }}>
                <Trash2 size={11} /> Delete
              </button>
            </div>
          )}
          <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{hs.body}</p>
        </div>
      )}
    </div>
  )
}

function OpRuleRow({ rule }: { rule: OperatorRule }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:opacity-90 transition-opacity"
        style={{ background: 'var(--bg-surface)' }}
      >
        <span className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded text-white" style={{ background: '#1e3a5f' }}>{rule.operator}</span>
            <Badge label={rule.category} colour={categoryBadgeColour[rule.category] ?? '#374151'} />
            {rule.applicable_voltage_kv && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{rule.applicable_voltage_kv} kV</span>
            )}
          </div>
          <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{rule.title}</p>
          <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>{rule.rule_ref}</p>
        </div>
        {rule.source_url && (
          <a href={rule.source_url} target="_blank" rel="noopener noreferrer"
            className="flex-shrink-0" style={{ color: 'var(--text-muted)' }}
            onClick={e => e.stopPropagation()}>
            <ExternalLink size={13} />
          </a>
        )}
      </button>
      {open && (
        <div className="px-4 py-3" style={{ background: 'var(--bg-elevated)' }}>
          <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{rule.body}</p>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReferenceLibraryClient({
  standards, hsRefs, lessons, opRules, templates,
  companyId, isAdmin, isSuperAdmin, canManageTemplates,
  complianceDocs, canEditCompliance, canEditRef,
}: Props) {
  const supabase = createClient()

  const [tab, setTab] = useState<Tab>('standards')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  // Local mutable lists for standards and H&S
  const [stdList, setStdList] = useState<StandardWithClauses[]>(standards)
  const [hsList, setHsList] = useState<HsReference[]>(hsRefs)

  // Standards add/edit state
  const [addingStd, setAddingStd] = useState(false)
  const [editingStdId, setEditingStdId] = useState<string | null>(null)
  const [stdSaving, setStdSaving] = useState(false)

  // H&S add/edit state
  const [addingHs, setAddingHs] = useState(false)
  const [editingHsId, setEditingHsId] = useState<string | null>(null)
  const [hsSaving, setHsSaving] = useState(false)

  const q = search.toLowerCase()

  const filteredStandards = stdList.filter(s =>
    (!q || s.ref.toLowerCase().includes(q) || s.title.toLowerCase().includes(q) || (s.summary ?? '').toLowerCase().includes(q)) &&
    (!categoryFilter || s.category === categoryFilter)
  )

  const filteredHs = hsList.filter(h =>
    !q || h.ref.toLowerCase().includes(q) || h.title.toLowerCase().includes(q) || h.body.toLowerCase().includes(q)
  )

  const filteredOps = opRules.filter(r =>
    (!q || r.title.toLowerCase().includes(q) || r.body.toLowerCase().includes(q) || r.operator.toLowerCase().includes(q)) &&
    (!categoryFilter || r.category === categoryFilter)
  )

  // ── Standards CRUD ──────────────────────────────────────────────────────────
  async function handleAddStd(form: StdFormState) {
    setStdSaving(true)
    const { data, error } = await supabase.from('standards').insert({
      ref: form.ref,
      title: form.title,
      category: form.category,
      status: form.status,
      body: form.body || null,
      effective_date: form.effective_date || null,
      source_url: form.source_url || null,
    }).select('*, standard_clauses(*)').single()
    setStdSaving(false)
    if (!error && data) {
      setStdList(prev => [data as StandardWithClauses, ...prev])
      setAddingStd(false)
    }
  }

  async function handleEditStd(id: string, form: StdFormState) {
    setStdSaving(true)
    const { data, error } = await supabase.from('standards').update({
      ref: form.ref,
      title: form.title,
      category: form.category,
      status: form.status,
      body: form.body || null,
      effective_date: form.effective_date || null,
      source_url: form.source_url || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id).select('*, standard_clauses(*)').single()
    setStdSaving(false)
    if (!error && data) {
      setStdList(prev => prev.map(s => s.id === id ? data as StandardWithClauses : s))
      setEditingStdId(null)
    }
  }

  async function handleDeleteStd(id: string) {
    if (!confirm('Delete this standard?')) return
    await supabase.from('standards').delete().eq('id', id)
    setStdList(prev => prev.filter(s => s.id !== id))
  }

  // ── H&S CRUD ────────────────────────────────────────────────────────────────
  async function handleAddHs(form: HsFormState) {
    setHsSaving(true)
    const { data, error } = await supabase.from('hs_references').insert({
      ref: form.ref,
      title: form.title,
      category: form.category,
      duty_holder: form.duty_holder || null,
      body: form.body || null,
      source_url: form.source_url || null,
    }).select().single()
    setHsSaving(false)
    if (!error && data) {
      setHsList(prev => [data as HsReference, ...prev])
      setAddingHs(false)
    }
  }

  async function handleEditHs(id: string, form: HsFormState) {
    setHsSaving(true)
    const { data, error } = await supabase.from('hs_references').update({
      ref: form.ref,
      title: form.title,
      category: form.category,
      duty_holder: form.duty_holder || null,
      body: form.body || null,
      source_url: form.source_url || null,
    }).eq('id', id).select().single()
    setHsSaving(false)
    if (!error && data) {
      setHsList(prev => prev.map(h => h.id === id ? data as HsReference : h))
      setEditingHsId(null)
    }
  }

  async function handleDeleteHs(id: string) {
    if (!confirm('Delete this H&S reference?')) return
    await supabase.from('hs_references').delete().eq('id', id)
    setHsList(prev => prev.filter(h => h.id !== id))
  }

  // ── Tabs ────────────────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'standards', label: 'Standards', icon: <BookOpen size={14} />, count: stdList.length },
    { id: 'hs', label: 'H&S References', icon: <AlertTriangle size={14} />, count: hsList.length },
    { id: 'lessons', label: 'Lessons Learned', icon: <Shield size={14} />, count: lessons.length },
    { id: 'operators', label: 'Operator / DNO Rules', icon: <Zap size={14} />, count: opRules.length },
    { id: 'templates', label: 'Templates', icon: <FileText size={14} />, count: templates.filter(t => !t.archived_at).length },
    { id: 'compliance', label: 'Compliance', icon: <FileCheck size={14} />, count: complianceDocs.length },
  ]

  const standardCategories = Array.from(new Set(stdList.map(s => s.category))).sort()
  const opCategories = Array.from(new Set(opRules.map(r => r.category))).sort()

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Reference Library</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Standards, H&S duties, lessons learned, DNO rules, templates and compliance documents
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-elevated)' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSearch(''); setCategoryFilter(''); setAddingStd(false); setAddingHs(false); setEditingStdId(null); setEditingHsId(null) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all flex-1 justify-center"
            style={tab === t.id
              ? { background: 'var(--accent)', color: '#fff' }
              : { color: 'var(--text-muted)' }
            }
          >
            {t.icon}
            {t.label}
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs"
              style={{ background: tab === t.id ? 'rgba(255,255,255,0.2)' : 'var(--bg-surface)', color: tab === t.id ? '#fff' : 'var(--text-muted)' }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search + filter */}
      {tab !== 'templates' && tab !== 'compliance' && (
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
          {(tab === 'standards' || tab === 'operators') && (
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              <option value="">All categories</option>
              {(tab === 'standards' ? standardCategories : opCategories).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          {tab === 'standards' && canEditRef && !addingStd && (
            <button onClick={() => setAddingStd(true)}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg font-medium text-white flex-shrink-0"
              style={{ background: 'var(--accent)' }}>
              <Plus size={14} /> Add standard
            </button>
          )}
          {tab === 'hs' && canEditRef && !addingHs && (
            <button onClick={() => setAddingHs(true)}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg font-medium text-white flex-shrink-0"
              style={{ background: 'var(--accent)' }}>
              <Plus size={14} /> Add reference
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div className="space-y-2">
        {tab === 'standards' && (
          <>
            {addingStd && (
              <StandardForm
                initial={emptyStdForm}
                onSave={handleAddStd}
                onCancel={() => setAddingStd(false)}
                saving={stdSaving}
              />
            )}
            {editingStdId && (
              (() => {
                const s = stdList.find(x => x.id === editingStdId)
                if (!s) return null
                return (
                  <StandardForm
                    initial={{ ref: s.ref, title: s.title, category: s.category, status: s.status, body: s.body ?? '', effective_date: s.effective_date ?? '', source_url: s.source_url ?? '' }}
                    onSave={form => handleEditStd(editingStdId, form)}
                    onCancel={() => setEditingStdId(null)}
                    saving={stdSaving}
                  />
                )
              })()
            )}
            {filteredStandards.length === 0 && !addingStd
              ? <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  {canEditRef ? 'No standards yet — click "+ Add standard" to create one.' : 'No standards found'}
                </p>
              : filteredStandards.filter(s => s.id !== editingStdId).map(s => (
                  <StandardRow
                    key={s.id}
                    std={s}
                    canEdit={canEditRef}
                    onEdit={() => { setEditingStdId(s.id); setAddingStd(false) }}
                    onDelete={() => handleDeleteStd(s.id)}
                  />
                ))
            }
          </>
        )}
        {tab === 'hs' && (
          <>
            {addingHs && (
              <HsForm
                initial={emptyHsForm}
                onSave={handleAddHs}
                onCancel={() => setAddingHs(false)}
                saving={hsSaving}
              />
            )}
            {editingHsId && (
              (() => {
                const h = hsList.find(x => x.id === editingHsId)
                if (!h) return null
                return (
                  <HsForm
                    initial={{ ref: h.ref, title: h.title, category: h.category, duty_holder: h.duty_holder ?? '', body: h.body ?? '', source_url: h.source_url ?? '' }}
                    onSave={form => handleEditHs(editingHsId, form)}
                    onCancel={() => setEditingHsId(null)}
                    saving={hsSaving}
                  />
                )
              })()
            )}
            {filteredHs.length === 0 && !addingHs
              ? <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  {canEditRef ? 'No H&S references yet — click "+ Add reference" to create one.' : 'No H&S references found'}
                </p>
              : filteredHs.filter(h => h.id !== editingHsId).map(h => (
                  <HsRow
                    key={h.id}
                    hs={h}
                    canEdit={canEditRef}
                    onEdit={() => { setEditingHsId(h.id); setAddingHs(false) }}
                    onDelete={() => handleDeleteHs(h.id)}
                  />
                ))
            }
          </>
        )}
        {tab === 'lessons' && (
          <LessonsLearnedTable initial={lessons} canEdit={canEditRef} />
        )}
        {tab === 'operators' && (
          filteredOps.length === 0
            ? <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No operator rules found</p>
            : filteredOps.map(r => <OpRuleRow key={r.id} rule={r} />)
        )}
        {tab === 'templates' && (
          <TemplatesLibrary initial={templates} companyId={companyId} canManage={canManageTemplates} canDelete={isAdmin} isSuperAdmin={isSuperAdmin} />
        )}
        {tab === 'compliance' && (
          <ComplianceTab initialDocs={complianceDocs} canEdit={canEditCompliance} companyId={companyId ?? ''} />
        )}
      </div>
    </div>
  )
}
