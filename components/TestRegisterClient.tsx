'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Plus, ChevronDown, ChevronRight, CheckCircle2, XCircle,
  AlertCircle, Clock, ClipboardList, Upload, FileText, Download,
  Trash2, X, Edit2, Save, Filter, FlaskConical
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { TestRecord, TestDocument, TestStatus, TestCategory } from '@/lib/types'

const CATEGORIES: TestCategory[] = [
  'Civils & Geotechnical', 'HV Electrical', 'LV Electrical', 'Protection & Control',
  'BESS & Inverter', 'FAT', 'SAT', 'DNO / Grid', 'Fire & Safety', 'Other',
]

const TEST_TYPES: Record<TestCategory, string[]> = {
  'Civils & Geotechnical': ['Plate Load Test', 'Ground Investigation', 'CBR Test', 'Settlement Monitoring', 'Compaction Test', 'Soakaway Test', 'Topographic Survey', 'Other'],
  'HV Electrical':         ['HV Cable Pressure Test', 'HV Cable Sheath Test', 'Insulation Resistance', 'Partial Discharge', 'Hi-Pot Test', 'Other'],
  'LV Electrical':         ['Insulation Resistance', 'Earth Loop Impedance', 'Continuity Test', 'RCD Test', 'Polarity Check', 'Other'],
  'Protection & Control':  ['Protection Relay Test', 'CT Ratio Test', 'VT Ratio Test', 'SCADA Point-to-Point', 'Interlock Test', 'Other'],
  'BESS & Inverter':       ['BMS Functional Test', 'Inverter Commissioning', 'Capacity Test', 'Charge/Discharge Cycle', 'Thermal Management Test', 'Other'],
  'FAT':                   ['Factory Acceptance Test', 'Witness Test', 'Type Test Review', 'Other'],
  'SAT':                   ['Site Acceptance Test', 'Integrated System Test', 'Performance Test', 'Other'],
  'DNO / Grid':            ['G99 Pre-energisation Check', 'Protection Settings Verification', 'Anti-Islanding Test', 'Power Quality Test', 'ECP.11.7 Compliance Test', 'Other'],
  'Fire & Safety':         ['Fire Detection & Alarm Test', 'Suppression System Test', 'Gas Detection Test', 'Emergency Lighting Test', 'Other'],
  'Other':                 ['Other'],
}

const STATUS_CONFIG: Record<TestStatus, { color: string; bg: string; icon: React.ReactNode }> = {
  'Planned':          { color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', icon: <Clock size={11} /> },
  'In Progress':      { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)', icon: <ClipboardList size={11} /> },
  'Pass':             { color: '#4ade80', bg: 'rgba(74,222,128,0.15)', icon: <CheckCircle2 size={11} /> },
  'Conditional Pass': { color: '#fb923c', bg: 'rgba(251,146,60,0.15)', icon: <AlertCircle size={11} /> },
  'Fail':             { color: '#f87171', bg: 'rgba(248,113,113,0.15)', icon: <XCircle size={11} /> },
  'Awaiting Review':  { color: '#c084fc', bg: 'rgba(192,132,252,0.15)', icon: <Clock size={11} /> },
  'Cancelled':        { color: '#475569', bg: 'rgba(71,85,105,0.15)', icon: <X size={11} /> },
}

const DOC_TYPES = ['Result Sheet', 'Certificate', 'Method Statement', 'Witness Sheet', 'Calibration Certificate', 'Other'] as const

interface Props {
  project: { id: string; name: string; client: string }
  tests: TestRecord[]
  canEdit: boolean
  userId: string
}

function StatusBadge({ status }: { status: TestStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ color: cfg.color, background: cfg.bg }}>
      {cfg.icon}{status}
    </span>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border px-4 py-3 flex flex-col gap-1" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
      <span className="text-2xl font-bold" style={{ color }}>{value}</span>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
  )
}

function PlateLoadResults({ data }: { data: any }) {
  if (!data) return null
  return (
    <div className="rounded-lg border p-3 mt-2 space-y-2" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>Structured Results — Plate Load Test</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        {data.bearing_pressure_kpa && <><span style={{ color: 'var(--text-muted)' }}>Bearing Pressure</span><span style={{ color: 'var(--text-primary)' }}>{data.bearing_pressure_kpa} kPa</span></>}
        {data.settlement_mm !== undefined && <><span style={{ color: 'var(--text-muted)' }}>Settlement</span><span style={{ color: 'var(--text-primary)' }}>{data.settlement_mm} mm</span></>}
        {data.pass_criterion && <><span style={{ color: 'var(--text-muted)' }}>Pass Criterion</span><span style={{ color: 'var(--text-primary)' }}>{data.pass_criterion}</span></>}
        {data.equipment_ref && <><span style={{ color: 'var(--text-muted)' }}>Equipment Ref</span><span style={{ color: 'var(--text-primary)' }}>{data.equipment_ref}</span></>}
        {data.operator && <><span style={{ color: 'var(--text-muted)' }}>Operator</span><span style={{ color: 'var(--text-primary)' }}>{data.operator}</span></>}
        {data.timestamp && <><span style={{ color: 'var(--text-muted)' }}>Recorded</span><span style={{ color: 'var(--text-primary)' }}>{new Date(data.timestamp).toLocaleString('en-GB')}</span></>}
      </div>
      {data.readings && Array.isArray(data.readings) && (
        <div>
          <p className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Load readings</p>
          <div className="flex flex-wrap gap-1">
            {data.readings.map((r: any, i: number) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                {r.load_kpa ?? r}kPa → {r.settlement_mm ?? ''}mm
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function TestRegisterClient({ project, tests: initTests, canEdit, userId }: Props) {
  const [tests, setTests] = useState<TestRecord[]>(initTests)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterCat, setFilterCat] = useState<string>('All')
  const [filterStatus, setFilterStatus] = useState<string>('All')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  // Summary counts
  const total    = tests.length
  const passed   = tests.filter(t => t.status === 'Pass').length
  const failed   = tests.filter(t => t.status === 'Fail').length
  const outstanding = tests.filter(t => ['Planned','In Progress','Awaiting Review'].includes(t.status)).length

  const filtered = tests.filter(t =>
    (filterCat === 'All' || t.category === filterCat) &&
    (filterStatus === 'All' || t.status === filterStatus)
  )

  function toggle(id: string) {
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  async function addTest(form: Partial<TestRecord>) {
    setSaving(true); setError('')
    const { data, error: err } = await supabase.from('test_register').insert([{
      ...form, project_id: project.id, created_by: userId,
    }]).select('*, test_documents(*)').single()
    if (err) { setError(err.message); setSaving(false); return }
    setTests(prev => [...prev, data])
    setShowAdd(false)
    setSaving(false)
  }

  async function updateTest(id: string, patch: Partial<TestRecord>) {
    setSaving(true); setError('')
    const { data, error: err } = await supabase.from('test_register')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id).select('*, test_documents(*)').single()
    if (err) { setError(err.message); setSaving(false); return }
    setTests(prev => prev.map(t => t.id === id ? data : t))
    setEditingId(null)
    setSaving(false)
  }

  async function deleteTest(id: string) {
    if (!confirm('Delete this test record?')) return
    await supabase.from('test_register').delete().eq('id', id)
    setTests(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="min-h-screen p-6 space-y-6" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/projects/${project.id}`} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Test Register</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{project.name} · {project.client}</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: 'linear-gradient(135deg, var(--accent), #a855f7)' }}>
            <Plus size={14} /> Add Test
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        <SummaryCard label="Total Tests"  value={total}       color="var(--text-primary)" />
        <SummaryCard label="Passed"       value={passed}      color="#4ade80" />
        <SummaryCard label="Failed"       value={failed}      color="#f87171" />
        <SummaryCard label="Outstanding"  value={outstanding} color="#60a5fa" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter size={13} style={{ color: 'var(--text-muted)' }} />
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="text-xs px-2.5 py-1.5 rounded-lg border"
          style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}>
          <option>All</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="text-xs px-2.5 py-1.5 rounded-lg border"
          style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}>
          <option>All</option>
          {Object.keys(STATUS_CONFIG).map(s => <option key={s}>{s}</option>)}
        </select>
        {(filterCat !== 'All' || filterStatus !== 'All') && (
          <button onClick={() => { setFilterCat('All'); setFilterStatus('All') }}
            className="text-xs px-2 py-1 rounded-lg"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            Clear
          </button>
        )}
        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
          {filtered.length} of {total} tests
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ background: '#3f1212', border: '1px solid #7f1d1d', color: '#fca5a5' }}>
          <AlertCircle size={12} />{error}
        </div>
      )}

      {/* Add Test form */}
      {showAdd && canEdit && (
        <TestForm
          categories={CATEGORIES}
          testTypes={TEST_TYPES}
          onSave={addTest}
          onCancel={() => setShowAdd(false)}
          saving={saving}
        />
      )}

      {/* Test rows */}
      {filtered.length === 0 && !showAdd && (
        <div className="text-center py-16 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <FlaskConical size={28} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>No tests recorded yet</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Add plate load tests, GIs, cable tests, FATs, SATs and more</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(test => (
          <div key={test.id} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            {editingId === test.id ? (
              <TestForm
                initial={test}
                categories={CATEGORIES}
                testTypes={TEST_TYPES}
                onSave={patch => updateTest(test.id, patch)}
                onCancel={() => setEditingId(null)}
                saving={saving}
              />
            ) : (
              <>
                {/* Row header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:opacity-90"
                  style={{ background: 'var(--bg-surface)' }}
                  onClick={() => toggle(test.id)}
                >
                  <div className="flex-shrink-0">
                    {expanded.has(test.id)
                      ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
                      : <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {test.test_ref && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(108,114,245,0.15)', color: 'var(--accent)' }}>
                          {test.test_ref}
                        </span>
                      )}
                      <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{test.title}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{test.category} · {test.test_type}</span>
                      {test.location && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>@ {test.location}</span>}
                      {test.planned_date && (
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {test.actual_date ? `Completed ${new Date(test.actual_date).toLocaleDateString('en-GB')}` : `Planned ${new Date(test.planned_date).toLocaleDateString('en-GB')}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={test.status} />
                  {canEdit && (
                    <div className="flex items-center gap-1 ml-2" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setEditingId(test.id)} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
                        <Edit2 size={12} />
                      </button>
                      <button onClick={() => deleteTest(test.id)} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: '#f87171' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Expanded detail */}
                {expanded.has(test.id) && (
                  <div className="px-4 pb-4 pt-2 space-y-3" style={{ background: 'var(--bg-elevated)' }}>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs">
                      {test.pass_criteria && (
                        <><span style={{ color: 'var(--text-muted)' }}>Pass Criteria</span><span style={{ color: 'var(--text-primary)' }}>{test.pass_criteria}</span></>
                      )}
                      {test.result_summary && (
                        <><span style={{ color: 'var(--text-muted)' }}>Result</span><span style={{ color: 'var(--text-primary)' }}>{test.result_summary}</span></>
                      )}
                      {test.witnessed_by && (
                        <><span style={{ color: 'var(--text-muted)' }}>Witnessed by</span><span style={{ color: 'var(--text-primary)' }}>{test.witnessed_by}</span></>
                      )}
                      {test.certificate_ref && (
                        <><span style={{ color: 'var(--text-muted)' }}>Certificate Ref</span><span style={{ color: 'var(--text-primary)' }}>{test.certificate_ref}</span></>
                      )}
                      {test.itp_ref && (
                        <><span style={{ color: 'var(--text-muted)' }}>ITP Ref</span><span style={{ color: 'var(--text-primary)' }}>{test.itp_ref}</span></>
                      )}
                      {test.notes && (
                        <><span style={{ color: 'var(--text-muted)' }}>Notes</span><span style={{ color: 'var(--text-primary)' }}>{test.notes}</span></>
                      )}
                    </div>

                    {/* Structured results (plate load tester etc.) */}
                    {test.results_data && <PlateLoadResults data={test.results_data} />}

                    {/* Documents */}
                    <TestDocuments
                      test={test}
                      canEdit={canEdit}
                      userId={userId}
                      onUpdate={updated => setTests(prev => prev.map(t => t.id === test.id ? updated : t))}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Test add / edit form ──────────────────────────────────────────────────────

function TestForm({
  initial,
  categories,
  testTypes,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<TestRecord>
  categories: TestCategory[]
  testTypes: Record<TestCategory, string[]>
  onSave: (data: Partial<TestRecord>) => void
  onCancel: () => void
  saving: boolean
}) {
  const [cat, setCat] = useState<TestCategory>(initial?.category ?? 'Civils & Geotechnical')
  const [form, setForm] = useState({
    test_ref:       initial?.test_ref ?? '',
    title:          initial?.title ?? '',
    test_type:      initial?.test_type ?? '',
    description:    initial?.description ?? '',
    planned_date:   initial?.planned_date ?? '',
    actual_date:    initial?.actual_date ?? '',
    location:       initial?.location ?? '',
    status:         initial?.status ?? 'Planned' as TestStatus,
    pass_criteria:  initial?.pass_criteria ?? '',
    result_summary: initial?.result_summary ?? '',
    witnessed_by:   initial?.witnessed_by ?? '',
    certificate_ref:initial?.certificate_ref ?? '',
    itp_ref:        initial?.itp_ref ?? '',
    notes:          initial?.notes ?? '',
  })

  const types = testTypes[cat] ?? ['Other']

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      ...form,
      category: cat,
      planned_date:   form.planned_date   || null,
      actual_date:    form.actual_date    || null,
      description:    form.description    || null,
      location:       form.location       || null,
      pass_criteria:  form.pass_criteria  || null,
      result_summary: form.result_summary || null,
      witnessed_by:   form.witnessed_by   || null,
      certificate_ref:form.certificate_ref|| null,
      itp_ref:        form.itp_ref        || null,
      notes:          form.notes          || null,
      test_ref:       form.test_ref       || null,
    })
  }

  const inputCls = "w-full rounded-lg border px-3 py-2 text-sm"
  const inputStyle = { background: 'var(--bg-elevated)', color: 'var(--text-primary)', borderColor: 'var(--border)' }

  return (
    <form onSubmit={submit} className="p-4 space-y-4 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--accent)' }}>
      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        {initial ? 'Edit Test' : 'Add Test'}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Test Ref</label>
          <input className={inputCls} style={inputStyle} placeholder="e.g. PLT-001"
            value={form.test_ref} onChange={e => set('test_ref', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>ITP Ref</label>
          <input className={inputCls} style={inputStyle} placeholder="ITP line ref"
            value={form.itp_ref} onChange={e => set('itp_ref', e.target.value)} />
        </div>
      </div>

      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Title *</label>
        <input required className={inputCls} style={inputStyle}
          placeholder="Descriptive test name"
          value={form.title} onChange={e => set('title', e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Category *</label>
          <select required className={inputCls} style={inputStyle}
            value={cat} onChange={e => { setCat(e.target.value as TestCategory); set('test_type', '') }}>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Test Type *</label>
          <select required className={inputCls} style={inputStyle}
            value={form.test_type} onChange={e => set('test_type', e.target.value)}>
            <option value="">Select…</option>
            {types.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Status</label>
          <select className={inputCls} style={inputStyle}
            value={form.status} onChange={e => set('status', e.target.value)}>
            {Object.keys(STATUS_CONFIG).map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Planned Date</label>
          <input type="date" className={inputCls} style={inputStyle}
            value={form.planned_date} onChange={e => set('planned_date', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Actual Date</label>
          <input type="date" className={inputCls} style={inputStyle}
            value={form.actual_date} onChange={e => set('actual_date', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Location / Circuit Ref</label>
          <input className={inputCls} style={inputStyle} placeholder="e.g. Grid foundation A1"
            value={form.location} onChange={e => set('location', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Witnessed By</label>
          <input className={inputCls} style={inputStyle} placeholder="Client rep / DNO / ICP"
            value={form.witnessed_by} onChange={e => set('witnessed_by', e.target.value)} />
        </div>
      </div>

      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Pass Criteria</label>
        <input className={inputCls} style={inputStyle} placeholder="e.g. Settlement ≤ 10mm at 150kPa"
          value={form.pass_criteria} onChange={e => set('pass_criteria', e.target.value)} />
      </div>

      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Result Summary</label>
        <input className={inputCls} style={inputStyle} placeholder="Brief outcome"
          value={form.result_summary} onChange={e => set('result_summary', e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Certificate Ref</label>
          <input className={inputCls} style={inputStyle}
            value={form.certificate_ref} onChange={e => set('certificate_ref', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Notes</label>
          <input className={inputCls} style={inputStyle}
            value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg text-sm"
          style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-60"
          style={{ background: 'var(--accent)' }}>
          <Save size={13} />{saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}

// ── Document upload panel per test ────────────────────────────────────────────

function TestDocuments({ test, canEdit, userId, onUpdate }: {
  test: TestRecord
  canEdit: boolean
  userId: string
  onUpdate: (t: TestRecord) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [docType, setDocType] = useState<typeof DOC_TYPES[number]>('Result Sheet')
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const docs = test.test_documents ?? []

  async function upload(file: File) {
    setUploading(true)
    const path = `${test.project_id}/tests/${test.id}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`
    const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: false })
    if (upErr) { alert(upErr.message); setUploading(false); return }

    const { error: dbErr } = await supabase.from('test_documents').insert([{
      test_id: test.id,
      storage_path: path,
      file_name: file.name,
      file_size: file.size,
      doc_type: docType,
      uploaded_by: userId,
    }])
    if (dbErr) { alert(dbErr.message); setUploading(false); return }

    // Reload test with docs
    const { data } = await supabase.from('test_register').select('*, test_documents(*)').eq('id', test.id).single()
    if (data) onUpdate(data)
    setUploading(false)
  }

  async function removeDoc(doc: TestDocument) {
    await supabase.storage.from('documents').remove([doc.storage_path])
    await supabase.from('test_documents').delete().eq('id', doc.id)
    const { data } = await supabase.from('test_register').select('*, test_documents(*)').eq('id', test.id).single()
    if (data) onUpdate(data)
  }

  async function download(doc: TestDocument) {
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
        Documents ({docs.length})
      </p>

      {docs.length > 0 && (
        <div className="space-y-1 mb-2">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <FileText size={12} style={{ color: 'var(--accent)' }} />
              <span className="flex-1 text-xs truncate" style={{ color: 'var(--text-primary)' }}>{doc.file_name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(108,114,245,0.1)', color: 'var(--accent)' }}>
                {doc.doc_type}
              </span>
              <button onClick={() => download(doc)} className="p-1 hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
                <Download size={11} />
              </button>
              {canEdit && (
                <button onClick={() => removeDoc(doc)} className="p-1 hover:opacity-70" style={{ color: '#f87171' }}>
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="flex items-center gap-2">
          <select value={docType} onChange={e => setDocType(e.target.value as any)}
            className="text-xs px-2 py-1.5 rounded-lg border flex-1"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}>
            {DOC_TYPES.map(d => <option key={d}>{d}</option>)}
          </select>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border disabled:opacity-60"
            style={{ color: 'var(--text-primary)', borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
            <Upload size={11} />{uploading ? 'Uploading…' : 'Upload'}
          </button>
          <input ref={fileRef} type="file" className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.docx,.doc,.csv"
            onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }} />
        </div>
      )}
    </div>
  )
}
