'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, X, Check, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { LessonLearned } from '@/lib/types'

const CATEGORIES = ['Design','Procurement','Construction','Commissioning','Electrical','Civils','Protection','Grid Connection','H&S','Other']
const SEVERITIES = ['Critical','Major','Minor','Observation'] as const
const LENSES = ['Standards & Compliance','Employer\'s Requirements','Constructability','Procurement','Testing & Commissioning','Civils & Temporary Works']

const severityColour: Record<string, string> = {
  Critical: 'var(--critical)',
  Major: 'var(--major)',
  Minor: 'var(--minor)',
  Observation: 'var(--observation)',
}

const emptyForm = {
  title: '',
  description: '',
  category: 'Design',
  severity: 'Major' as typeof SEVERITIES[number],
  source: '',
  project_ref: '',
  review_lenses: [] as string[],
}

type FormState = typeof emptyForm

function LensCheckboxes({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {LENSES.map(l => {
        const on = selected.includes(l)
        return (
          <button
            key={l}
            type="button"
            onClick={() => onChange(on ? selected.filter(x => x !== l) : [...selected, l])}
            className="text-xs px-2 py-1 rounded-lg border transition-all"
            style={{
              borderColor: on ? 'var(--accent)' : 'var(--border)',
              background: on ? 'rgba(108,114,245,0.15)' : 'transparent',
              color: on ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            {l}
          </button>
        )
      })}
    </div>
  )
}

function LessonForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: FormState
  onSave: (f: FormState) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState(initial)
  const set = (k: keyof FormState, v: any) => setForm(f => ({ ...f, [k]: v }))

  const field = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    borderRadius: '0.5rem',
    padding: '0.5rem 0.75rem',
    fontSize: '0.75rem',
    width: '100%',
    outline: 'none',
  } as React.CSSProperties

  return (
    <div className="space-y-3 rounded-xl border p-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--accent)' }}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Title *</label>
          <input style={field} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Brief description of the issue" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Category</label>
          <select style={field} value={form.category} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Severity</label>
          <select style={field} value={form.severity} onChange={e => set('severity', e.target.value as any)}>
            {SEVERITIES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Source project / ref</label>
          <input style={field} value={form.project_ref} onChange={e => set('project_ref', e.target.value)} placeholder="e.g. Braco 2024" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Source detail</label>
          <input style={field} value={form.source} onChange={e => set('source', e.target.value)} placeholder="e.g. Site inspection, RFI #42" />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Full description *</label>
          <textarea
            style={{ ...field, minHeight: 80, resize: 'vertical' }}
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="What happened, why, and what should be done differently next time…"
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Review lenses</label>
          <LensCheckboxes selected={form.review_lenses} onChange={v => set('review_lenses', v)} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border"
          style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
          <X size={12} /> Cancel
        </button>
        <button type="button"
          onClick={() => form.title.trim() && form.description.trim() && onSave(form)}
          disabled={saving || !form.title.trim() || !form.description.trim()}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium text-white disabled:opacity-50"
          style={{ background: 'var(--accent)' }}>
          <Check size={12} /> {saving ? 'Saving…' : 'Save lesson'}
        </button>
      </div>
    </div>
  )
}

interface Props {
  initial: LessonLearned[]
  isAdmin: boolean
}

export default function LessonsLearnedTable({ initial, isAdmin }: Props) {
  const [lessons, setLessons] = useState(initial)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [sevFilter, setSevFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const supabase = createClient()

  async function handleAdd(form: FormState) {
    setSaving(true)
    const { data, error } = await supabase.from('lessons_learned').insert({
      title: form.title,
      description: form.description,
      category: form.category,
      severity: form.severity,
      source: form.source || null,
      project_ref: form.project_ref || null,
      review_lenses: form.review_lenses,
    }).select().single()
    setSaving(false)
    if (!error && data) {
      setLessons(prev => [data, ...prev])
      setAdding(false)
    }
  }

  async function handleEdit(id: string, form: FormState) {
    setSaving(true)
    const { data, error } = await supabase.from('lessons_learned').update({
      title: form.title,
      description: form.description,
      category: form.category,
      severity: form.severity,
      source: form.source || null,
      project_ref: form.project_ref || null,
      review_lenses: form.review_lenses,
      updated_at: new Date().toISOString(),
    }).eq('id', id).select().single()
    setSaving(false)
    if (!error && data) {
      setLessons(prev => prev.map(l => l.id === id ? data : l))
      setEditingId(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this lesson?')) return
    await supabase.from('lessons_learned').delete().eq('id', id)
    setLessons(prev => prev.filter(l => l.id !== id))
  }

  const q = search.toLowerCase()
  const filtered = lessons.filter(l =>
    (!q || l.title.toLowerCase().includes(q) || l.description.toLowerCase().includes(q) || (l.source ?? '').toLowerCase().includes(q)) &&
    (!catFilter || l.category === catFilter) &&
    (!sevFilter || l.severity === sevFilter)
  )

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Search lessons…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-40 rounded-lg px-3 py-2 text-sm outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={sevFilter} onChange={e => setSevFilter(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          <option value="">All severities</option>
          {SEVERITIES.map(s => <option key={s}>{s}</option>)}
        </select>
        {!adding && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg font-medium text-white"
            style={{ background: 'var(--accent)' }}>
            <Plus size={14} /> Add lesson
          </button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <LessonForm initial={emptyForm} onSave={handleAdd} onCancel={() => setAdding(false)} saving={saving} />
      )}

      {/* Count */}
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {filtered.length} lesson{filtered.length !== 1 ? 's' : ''}{lessons.length !== filtered.length ? ` of ${lessons.length}` : ''}
      </p>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
              <th className="px-4 py-2.5 text-left font-medium w-16" style={{ color: 'var(--text-muted)' }}>Severity</th>
              <th className="px-4 py-2.5 text-left font-medium" style={{ color: 'var(--text-muted)' }}>Title</th>
              <th className="px-4 py-2.5 text-left font-medium w-28 hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>Category</th>
              <th className="px-4 py-2.5 text-left font-medium w-28 hidden lg:table-cell" style={{ color: 'var(--text-muted)' }}>Source</th>
              {isAdmin && <th className="px-4 py-2.5 w-16" />}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                  No lessons found
                </td>
              </tr>
            )}
            {filtered.map(l => (
              <>
                <tr
                  key={l.id}
                  className="border-t cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ borderColor: 'var(--border)', background: expandedId === l.id ? 'var(--bg-elevated)' : 'var(--bg-surface)' }}
                  onClick={() => setExpandedId(expandedId === l.id ? null : l.id)}
                >
                  <td className="px-4 py-3">
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium text-white"
                      style={{ background: severityColour[l.severity] }}>
                      {l.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                    <div className="flex items-center gap-1.5">
                      <ChevronDown size={11} className="flex-shrink-0 transition-transform"
                        style={{ color: 'var(--text-muted)', transform: expandedId === l.id ? 'rotate(180deg)' : 'rotate(-90deg)' }} />
                      {l.title}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>{l.category}</td>
                  <td className="px-4 py-3 hidden lg:table-cell" style={{ color: 'var(--text-muted)' }}>
                    {(l as any).project_ref ?? l.source ?? '—'}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setEditingId(l.id)} style={{ color: 'var(--text-muted)' }}>
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => handleDelete(l.id)} style={{ color: 'var(--critical)' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
                {expandedId === l.id && editingId !== l.id && (
                  <tr key={`${l.id}-exp`} style={{ background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)' }}>
                    <td colSpan={isAdmin ? 5 : 4} className="px-6 py-3">
                      <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{l.description}</p>
                      {l.review_lenses?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {l.review_lenses.map(lens => (
                            <span key={lens} className="text-[10px] px-1.5 py-0.5 rounded border"
                              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-surface)' }}>
                              {lens}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                {editingId === l.id && (
                  <tr key={`${l.id}-edit`} style={{ borderTop: '1px solid var(--border)' }}>
                    <td colSpan={isAdmin ? 5 : 4} className="px-4 py-3">
                      <LessonForm
                        initial={{
                          title: l.title,
                          description: l.description,
                          category: l.category,
                          severity: l.severity as any,
                          source: l.source ?? '',
                          project_ref: (l as any).project_ref ?? '',
                          review_lenses: l.review_lenses ?? [],
                        }}
                        onSave={form => handleEdit(l.id, form)}
                        onCancel={() => setEditingId(null)}
                        saving={saving}
                      />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
