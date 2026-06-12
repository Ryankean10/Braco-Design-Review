'use client'

import { useState, useTransition } from 'react'
import { BookOpen, Plus, X, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Standard, HsReference, LessonLearned, OperatorRule } from '@/lib/types'

type Tab = 'standards' | 'hs' | 'lessons' | 'operators'

interface StandardWithClauses extends Standard {
  standard_clauses?: Array<{ id: string; clause_ref: string; heading: string; body: string; severity_hint: string | null }>
}

interface Props {
  projectId: string
  // currently linked
  linkedStandards: StandardWithClauses[]
  linkedHs: HsReference[]
  linkedLessons: LessonLearned[]
  linkedOps: OperatorRule[]
  // global library (for the picker)
  allStandards: StandardWithClauses[]
  allHs: HsReference[]
  allLessons: LessonLearned[]
  allOps: OperatorRule[]
}

const severityColour: Record<string, string> = {
  Critical: 'var(--critical)',
  Major: 'var(--major)',
  Minor: 'var(--minor)',
  Observation: 'var(--observation)',
}

function SeverityChip({ sev }: { sev: string | null }) {
  if (!sev) return null
  return <span className="text-xs px-1.5 py-0.5 rounded font-medium text-white" style={{ background: severityColour[sev] ?? '#6b7280' }}>{sev}</span>
}

function LinkedStandard({ std, onRemove }: { std: StandardWithClauses; onRemove: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-start gap-2 px-3 py-2.5" style={{ background: 'var(--bg-elevated)' }}>
        <button onClick={() => setOpen(o => !o)} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono font-semibold" style={{ color: 'var(--accent)' }}>{std.ref}</p>
          <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{std.title}</p>
        </div>
        {std.source_url && (
          <a href={std.source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)' }}><ExternalLink size={11} /></a>
        )}
        <button onClick={onRemove} className="flex-shrink-0 hover:opacity-80" style={{ color: 'var(--text-muted)' }}><X size={13} /></button>
      </div>
      {open && std.standard_clauses && std.standard_clauses.length > 0 && (
        <div className="px-3 pb-2.5 space-y-1.5" style={{ background: 'var(--bg-surface)' }}>
          {std.standard_clauses.map(cl => (
            <div key={cl.id} className="rounded px-2 py-1.5 border" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-mono" style={{ color: 'var(--accent)' }}>{cl.clause_ref}</span>
                <SeverityChip sev={cl.severity_hint} />
              </div>
              <p className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--text-primary)' }}>{cl.heading}</p>
              <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>{cl.body.slice(0, 200)}{cl.body.length > 200 ? '…' : ''}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LinkedItem({ label: primary, sub, onRemove, url }: { label: string; sub?: string; onRemove: () => void; url?: string | null }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2 border rounded-lg" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{primary}</p>
        {sub && <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
      </div>
      {url && <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)' }}><ExternalLink size={11} /></a>}
      <button onClick={onRemove} className="hover:opacity-80 flex-shrink-0" style={{ color: 'var(--text-muted)' }}><X size={13} /></button>
    </div>
  )
}

export default function ProjectReferences({
  projectId,
  linkedStandards: initStandards,
  linkedHs: initHs,
  linkedLessons: initLessons,
  linkedOps: initOps,
  allStandards,
  allHs,
  allLessons,
  allOps,
}: Props) {
  const [tab, setTab] = useState<Tab>('standards')
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()

  const [linkedStandards, setLinkedStandards] = useState(initStandards)
  const [linkedHs, setLinkedHs] = useState(initHs)
  const [linkedLessons, setLinkedLessons] = useState(initLessons)
  const [linkedOps, setLinkedOps] = useState(initOps)

  const supabase = createClient()

  async function addLink(type: Tab, id: string) {
    const tableMap: Record<Tab, string> = {
      standards: 'project_standards',
      hs: 'project_hs_references',
      lessons: 'project_lessons_learned',
      operators: 'project_operator_rules',
    }
    const colMap: Record<Tab, string> = {
      standards: 'standard_id',
      hs: 'hs_id',
      lessons: 'lesson_id',
      operators: 'rule_id',
    }
    await supabase.from(tableMap[type]).insert({ project_id: projectId, [colMap[type]]: id })
    startTransition(() => {
      if (type === 'standards') setLinkedStandards(prev => [...prev, allStandards.find(s => s.id === id)!])
      if (type === 'hs') setLinkedHs(prev => [...prev, allHs.find(h => h.id === id)!])
      if (type === 'lessons') setLinkedLessons(prev => [...prev, allLessons.find(l => l.id === id)!])
      if (type === 'operators') setLinkedOps(prev => [...prev, allOps.find(r => r.id === id)!])
    })
  }

  async function removeLink(type: Tab, id: string) {
    const tableMap: Record<Tab, string> = {
      standards: 'project_standards',
      hs: 'project_hs_references',
      lessons: 'project_lessons_learned',
      operators: 'project_operator_rules',
    }
    const colMap: Record<Tab, string> = {
      standards: 'standard_id',
      hs: 'hs_id',
      lessons: 'lesson_id',
      operators: 'rule_id',
    }
    await supabase.from(tableMap[type]).delete()
      .eq('project_id', projectId).eq(colMap[type], id)
    startTransition(() => {
      if (type === 'standards') setLinkedStandards(prev => prev.filter(s => s.id !== id))
      if (type === 'hs') setLinkedHs(prev => prev.filter(h => h.id !== id))
      if (type === 'lessons') setLinkedLessons(prev => prev.filter(l => l.id !== id))
      if (type === 'operators') setLinkedOps(prev => prev.filter(r => r.id !== id))
    })
  }

  // Items not yet linked (for the picker)
  const linkedIds = {
    standards: new Set(linkedStandards.map(s => s.id)),
    hs: new Set(linkedHs.map(h => h.id)),
    lessons: new Set(linkedLessons.map(l => l.id)),
    operators: new Set(linkedOps.map(r => r.id)),
  }

  const q = search.toLowerCase()

  const availableStandards = allStandards.filter(s => !linkedIds.standards.has(s.id) &&
    (!q || s.ref.toLowerCase().includes(q) || s.title.toLowerCase().includes(q)))
  const availableHs = allHs.filter(h => !linkedIds.hs.has(h.id) &&
    (!q || h.ref.toLowerCase().includes(q) || h.title.toLowerCase().includes(q)))
  const availableLessons = allLessons.filter(l => !linkedIds.lessons.has(l.id) &&
    (!q || l.title.toLowerCase().includes(q)))
  const availableOps = allOps.filter(r => !linkedIds.operators.has(r.id) &&
    (!q || r.operator.toLowerCase().includes(q) || r.title.toLowerCase().includes(q)))

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'standards', label: 'Standards', count: linkedStandards.length },
    { id: 'hs', label: 'H&S', count: linkedHs.length },
    { id: 'lessons', label: 'Lessons', count: linkedLessons.length },
    { id: 'operators', label: 'DNO Rules', count: linkedOps.length },
  ]

  const totalLinked = linkedStandards.length + linkedHs.length + linkedLessons.length + linkedOps.length

  return (
    <div className="rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <BookOpen size={16} style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Applicable References
          </span>
          {totalLinked > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(108,114,245,0.15)', color: 'var(--accent)' }}>
              {totalLinked}
            </span>
          )}
        </div>
        <button
          onClick={() => { setAdding(a => !a); setSearch('') }}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium text-white"
          style={{ background: adding ? 'var(--border)' : 'var(--accent)', color: adding ? 'var(--text-muted)' : '#fff' }}
        >
          {adding ? <X size={12} /> : <Plus size={12} />}
          {adding ? 'Done' : 'Add reference'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-3">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-3 py-1 rounded-md text-xs font-medium transition-all"
            style={tab === t.id
              ? { background: 'var(--accent)', color: '#fff' }
              : { color: 'var(--text-muted)', background: 'transparent' }
            }
          >
            {t.label}
            {t.count > 0 && <span className="ml-1.5 opacity-70">{t.count}</span>}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-2">
        {/* Linked items */}
        {tab === 'standards' && (
          linkedStandards.length === 0
            ? <p className="text-xs py-3 text-center" style={{ color: 'var(--text-muted)' }}>No standards linked — use Add reference to link from the library</p>
            : linkedStandards.map(s => <LinkedStandard key={s.id} std={s} onRemove={() => removeLink('standards', s.id)} />)
        )}
        {tab === 'hs' && (
          linkedHs.length === 0
            ? <p className="text-xs py-3 text-center" style={{ color: 'var(--text-muted)' }}>No H&S references linked</p>
            : linkedHs.map(h => <LinkedItem key={h.id} label={h.title} sub={`${h.ref} · ${h.duty_holder ?? ''}`} url={h.source_url} onRemove={() => removeLink('hs', h.id)} />)
        )}
        {tab === 'lessons' && (
          linkedLessons.length === 0
            ? <p className="text-xs py-3 text-center" style={{ color: 'var(--text-muted)' }}>No lessons learned linked</p>
            : linkedLessons.map(l => <LinkedItem key={l.id} label={l.title} sub={`${l.severity} · ${l.category}`} onRemove={() => removeLink('lessons', l.id)} />)
        )}
        {tab === 'operators' && (
          linkedOps.length === 0
            ? <p className="text-xs py-3 text-center" style={{ color: 'var(--text-muted)' }}>No operator / DNO rules linked</p>
            : linkedOps.map(r => <LinkedItem key={r.id} label={r.title} sub={`${r.operator} · ${r.rule_ref}`} url={r.source_url} onRemove={() => removeLink('operators', r.id)} />)
        )}

        {/* Picker */}
        {adding && (
          <div className="mt-3 border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <div className="px-3 py-2 border-b" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
              <input
                type="text"
                placeholder="Search library…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
                className="w-full bg-transparent text-xs outline-none"
                style={{ color: 'var(--text-primary)' }}
              />
            </div>
            <div className="max-h-56 overflow-y-auto">
              {tab === 'standards' && availableStandards.map(s => (
                <button key={s.id} onClick={() => addLink('standards', s.id)} disabled={isPending}
                  className="w-full flex items-start gap-2 px-3 py-2 border-b text-left hover:opacity-80 transition-opacity"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
                  <Plus size={11} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                  <div className="min-w-0">
                    <p className="text-xs font-mono font-semibold" style={{ color: 'var(--accent)' }}>{s.ref}</p>
                    <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{s.title}</p>
                  </div>
                </button>
              ))}
              {tab === 'hs' && availableHs.map(h => (
                <button key={h.id} onClick={() => addLink('hs', h.id)} disabled={isPending}
                  className="w-full flex items-start gap-2 px-3 py-2 border-b text-left hover:opacity-80 transition-opacity"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
                  <Plus size={11} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{h.title}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{h.ref}</p>
                  </div>
                </button>
              ))}
              {tab === 'lessons' && availableLessons.map(l => (
                <button key={l.id} onClick={() => addLink('lessons', l.id)} disabled={isPending}
                  className="w-full flex items-start gap-2 px-3 py-2 border-b text-left hover:opacity-80 transition-opacity"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
                  <Plus size={11} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{l.title}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{l.severity} · {l.category}</p>
                  </div>
                </button>
              ))}
              {tab === 'operators' && availableOps.map(r => (
                <button key={r.id} onClick={() => addLink('operators', r.id)} disabled={isPending}
                  className="w-full flex items-start gap-2 px-3 py-2 border-b text-left hover:opacity-80 transition-opacity"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
                  <Plus size={11} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{r.title}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{r.operator} · {r.rule_ref}</p>
                  </div>
                </button>
              ))}
              {(
                (tab === 'standards' && availableStandards.length === 0) ||
                (tab === 'hs' && availableHs.length === 0) ||
                (tab === 'lessons' && availableLessons.length === 0) ||
                (tab === 'operators' && availableOps.length === 0)
              ) && (
                <p className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                  {search ? 'No matches' : 'All library entries already linked'}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
