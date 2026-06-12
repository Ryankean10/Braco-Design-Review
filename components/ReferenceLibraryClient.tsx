'use client'

import { useState } from 'react'
import { BookOpen, Shield, AlertTriangle, Zap, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import type { Standard, HsReference, LessonLearned, OperatorRule } from '@/lib/types'
import LessonsLearnedTable from '@/components/LessonsLearned'
import StandardDocUpload from '@/components/StandardDocUpload'

type Tab = 'standards' | 'hs' | 'lessons' | 'operators'

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
  isAdmin: boolean
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

function StandardRow({ std, isAdmin }: { std: StandardWithClauses; isAdmin: boolean }) {
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
          {std.summary && (
            <p className="text-xs pt-3" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{std.summary}</p>
          )}
          <StandardDocUpload
            standardId={std.id}
            docStoragePath={std.doc_storage_path ?? null}
            docFileName={std.doc_file_name ?? null}
            isAdmin={isAdmin}
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

function HsRow({ hs }: { hs: HsReference }) {
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
        <div className="px-4 py-3" style={{ background: 'var(--bg-elevated)' }}>
          <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{hs.body}</p>
        </div>
      )}
    </div>
  )
}

function LessonRow({ lesson }: { lesson: LessonLearned }) {
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
            <SeverityChip sev={lesson.severity} />
            <Badge label={lesson.category} colour={categoryBadgeColour[lesson.category] ?? '#374151'} />
          </div>
          <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{lesson.title}</p>
          {lesson.source && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Source: {lesson.source}</p>}
        </div>
      </button>
      {open && (
        <div className="px-4 py-3" style={{ background: 'var(--bg-elevated)' }}>
          <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{lesson.description}</p>
          {lesson.review_lenses?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {lesson.review_lenses.map(l => (
                <span key={l} className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{l}</span>
              ))}
            </div>
          )}
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

export default function ReferenceLibraryClient({ standards, hsRefs, lessons, opRules, isAdmin }: Props) {
  const [tab, setTab] = useState<Tab>('standards')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const q = search.toLowerCase()

  const filteredStandards = standards.filter(s =>
    (!q || s.ref.toLowerCase().includes(q) || s.title.toLowerCase().includes(q) || (s.summary ?? '').toLowerCase().includes(q)) &&
    (!categoryFilter || s.category === categoryFilter)
  )

  const filteredHs = hsRefs.filter(h =>
    !q || h.ref.toLowerCase().includes(q) || h.title.toLowerCase().includes(q) || h.body.toLowerCase().includes(q)
  )

  const filteredLessons = lessons.filter(l =>
    !q || l.title.toLowerCase().includes(q) || l.description.toLowerCase().includes(q)
  )

  const filteredOps = opRules.filter(r =>
    (!q || r.title.toLowerCase().includes(q) || r.body.toLowerCase().includes(q) || r.operator.toLowerCase().includes(q)) &&
    (!categoryFilter || r.category === categoryFilter)
  )

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'standards', label: 'Standards', icon: <BookOpen size={14} />, count: standards.length },
    { id: 'hs', label: 'H&S References', icon: <AlertTriangle size={14} />, count: hsRefs.length },
    { id: 'lessons', label: 'Lessons Learned', icon: <Shield size={14} />, count: lessons.length },
    { id: 'operators', label: 'Operator / DNO Rules', icon: <Zap size={14} />, count: opRules.length },
  ]

  const standardCategories = Array.from(new Set(standards.map(s => s.category))).sort()
  const opCategories = Array.from(new Set(opRules.map(r => r.category))).sort()

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Reference Library</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Standards, H&S duties, lessons learned and DNO rules that drive the AI review engine
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-elevated)' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSearch(''); setCategoryFilter('') }}
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
      </div>

      {/* Content */}
      <div className="space-y-2">
        {tab === 'standards' && (
          filteredStandards.length === 0
            ? <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No standards found</p>
            : filteredStandards.map(s => <StandardRow key={s.id} std={s} isAdmin={isAdmin} />)
        )}
        {tab === 'hs' && (
          filteredHs.length === 0
            ? <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No H&S references found</p>
            : filteredHs.map(h => <HsRow key={h.id} hs={h} />)
        )}
        {tab === 'lessons' && (
          <LessonsLearnedTable initial={lessons} isAdmin={isAdmin} />
        )}
        {tab === 'operators' && (
          filteredOps.length === 0
            ? <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No operator rules found</p>
            : filteredOps.map(r => <OpRuleRow key={r.id} rule={r} />)
        )}
      </div>
    </div>
  )
}
