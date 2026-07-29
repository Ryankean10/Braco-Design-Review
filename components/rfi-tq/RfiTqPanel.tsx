'use client'

import { useState, useTransition } from 'react'
import { Plus, ChevronDown, ChevronRight, Clock, CheckCircle2, AlertCircle, X, History, Pencil, RotateCcw, Sparkles, Paperclip, Upload, Trash2, Download, FileText, Loader2 } from 'lucide-react'

type RfiTqStatus = 'received' | 'submitted' | 'response_received' | 'sent_to_team' | 'closed'

interface AuditEntry {
  id: string
  user_name: string
  action: string
  changes: { field: string; old_value: unknown; new_value: unknown }[]
  created_at: string
}

interface Attachment {
  id: string
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  uploaded_at: string
}

interface AiAnalysis {
  found_in_documents: boolean
  confidence: 'high' | 'medium' | 'low' | 'none'
  summary: string
  sources: { document: string; clause_ref: string | null; verbatim_text: string; relevance: string }[]
  technical_analysis: string
  suggested_response: string
  docs_searched?: number
  doc_labels?: string[]
}

interface RfiTq {
  id: string
  type: 'RFI' | 'TQ'
  number: string
  title: string
  status: RfiTqStatus
  to_contact: string | null
  from_contact: string | null
  contractor_name: string | null
  date_sent: string | null
  date_received: string | null
  document_reference: string | null
  document_title: string | null
  description: string | null
  possible_solutions: { solution: string; cost_impact: string; programme_impact: string }[] | null
  proposed_solution: string | null
  cost_impact: string | null
  programme_impact: string | null
  is_scope_change: boolean
  response_required_by: string | null
  response_sla_days: number | null
  submitted_to_client_at: string | null
  sla_expires_at: string | null
  response_received_at: string | null
  client_response: string | null
  sent_to_team_at: string | null
  closed_at: string | null
  created_at: string
  ai_analysis?: AiAnalysis | null
  ai_analysed_at?: string | null
  audit_log?: AuditEntry[]
}

const STATUS_LABELS: Record<RfiTqStatus, string> = {
  received:          'Received',
  submitted:         'Submitted to Client',
  response_received: 'Response Received',
  sent_to_team:      'Sent to Team',
  closed:            'Closed',
}

const STATUS_ORDER: RfiTqStatus[] = ['received','submitted','response_received','sent_to_team','closed']

const STATUS_COLOR: Record<RfiTqStatus, { bg: string; text: string; border: string }> = {
  received:          { bg: 'rgba(99,102,241,0.12)',  text: '#818cf8', border: 'rgba(99,102,241,0.3)' },
  submitted:         { bg: 'rgba(251,146,60,0.12)',  text: '#fb923c', border: 'rgba(251,146,60,0.3)' },
  response_received: { bg: 'rgba(34,197,94,0.12)',   text: '#22c55e', border: 'rgba(34,197,94,0.3)' },
  sent_to_team:      { bg: 'rgba(56,189,248,0.12)',  text: '#38bdf8', border: 'rgba(56,189,248,0.3)' },
  closed:            { bg: 'rgba(148,163,184,0.1)',  text: '#94a3b8', border: 'rgba(148,163,184,0.2)' },
}

const SLA_OPTIONS = [1, 3, 5, 10, 14]

const BLANK_FORM = {
  type: 'TQ' as 'RFI' | 'TQ',
  number: '',
  title: '',
  to_contact: '',
  from_contact: '',
  contractor_name: '',
  date_sent: '',
  date_received: '',
  document_reference: '',
  document_title: '',
  description: '',
  proposed_solution: '',
  cost_impact: '',
  programme_impact: '',
  is_scope_change: false,
  response_required_by: '',
  possible_solutions: [] as { solution: string; cost_impact: string; programme_impact: string }[],
}

function slaOverdue(item: RfiTq): boolean {
  if (!item.sla_expires_at || item.status !== 'submitted') return false
  return new Date(item.sla_expires_at) < new Date()
}

function daysUntilSla(item: RfiTq): number | null {
  if (!item.sla_expires_at) return null
  const diff = new Date(item.sla_expires_at).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function fmt(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtField(field: string): string {
  return field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function fmtVal(v: unknown): string {
  if (v === null || v === undefined || v === '') return '(empty)'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}

export default function RfiTqPanel({ projectId, initialItems, canEdit }: {
  projectId: string
  initialItems: RfiTq[]
  canEdit: boolean
}) {
  const [items, setItems] = useState<RfiTq[]>(initialItems)
  const [showClosed, setShowClosed] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [auditItem, setAuditItem] = useState<RfiTq | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState<RfiTq | null>(null)
  const [form, setForm] = useState({ ...BLANK_FORM })
  const [slaModal, setSlaModal] = useState<{ item: RfiTq } | null>(null)
  const [slaValue, setSlaValue] = useState<number>(5)
  const [responseModal, setResponseModal] = useState<{ item: RfiTq } | null>(null)
  const [responseText, setResponseText] = useState('')
  const [, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState<string | null>(null)   // rfiId being analysed
  const [aiResults, setAiResults] = useState<Record<string, AiAnalysis>>({})
  const [aiError, setAiError] = useState<Record<string, string>>({})
  const [attachments, setAttachments] = useState<Record<string, Attachment[]>>({})
  const [attachUploading, setAttachUploading] = useState<Record<string, boolean>>({})
  const [showAttachPanel, setShowAttachPanel] = useState<string | null>(null)

  const visible = items.filter(i => showClosed || i.status !== 'closed')
  const openCount = items.filter(i => i.status !== 'closed').length

  async function reload() {
    const r = await fetch(`/api/projects/${projectId}/rfi-tq`)
    if (r.ok) setItems(await r.json())
  }

  async function loadAudit(item: RfiTq) {
    const r = await fetch(`/api/projects/${projectId}/rfi-tq/${item.id}`)
    if (r.ok) {
      const d = await r.json()
      setAuditItem(d)
    }
  }

  function openNewForm() {
    setEditingItem(null)
    setForm({ ...BLANK_FORM })
    setShowForm(true)
    setError(null)
  }

  function openEditForm(item: RfiTq) {
    setEditingItem(item)
    setForm({
      type: item.type,
      number: item.number,
      title: item.title,
      to_contact: item.to_contact ?? '',
      from_contact: item.from_contact ?? '',
      contractor_name: item.contractor_name ?? '',
      date_sent: item.date_sent ?? '',
      date_received: item.date_received ?? '',
      document_reference: item.document_reference ?? '',
      document_title: item.document_title ?? '',
      description: item.description ?? '',
      proposed_solution: item.proposed_solution ?? '',
      cost_impact: item.cost_impact ?? '',
      programme_impact: item.programme_impact ?? '',
      is_scope_change: item.is_scope_change,
      response_required_by: item.response_required_by ?? '',
      possible_solutions: item.possible_solutions ?? [],
    })
    setShowForm(true)
    setError(null)
  }

  async function saveForm() {
    if (!form.number.trim() || !form.title.trim()) {
      setError('Number and title are required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        ...form,
        possible_solutions: form.possible_solutions.length > 0 ? form.possible_solutions : null,
        date_sent: form.date_sent || null,
        date_received: form.date_received || null,
        response_required_by: form.response_required_by || null,
      }
      const url = editingItem
        ? `/api/projects/${projectId}/rfi-tq/${editingItem.id}`
        : `/api/projects/${projectId}/rfi-tq`
      const r = await fetch(url, {
        method: editingItem ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) { const d = await r.json(); setError(d.error ?? 'Save failed'); return }
      setShowForm(false)
      startTransition(() => reload())
    } finally {
      setSaving(false)
    }
  }

  async function advanceStatus(item: RfiTq, nextStatus: RfiTqStatus, extra?: Record<string, unknown>) {
    const r = await fetch(`/api/projects/${projectId}/rfi-tq/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus, ...extra }),
    })
    if (r.ok) startTransition(() => reload())
  }

  function nextStatus(current: RfiTqStatus): RfiTqStatus | null {
    const idx = STATUS_ORDER.indexOf(current)
    return idx < STATUS_ORDER.length - 1 ? STATUS_ORDER[idx + 1] : null
  }

  function addSolution() {
    setForm(f => ({ ...f, possible_solutions: [...f.possible_solutions, { solution: '', cost_impact: '', programme_impact: '' }] }))
  }

  function updateSolution(i: number, field: string, value: string) {
    setForm(f => {
      const sols = [...f.possible_solutions]
      sols[i] = { ...sols[i], [field]: value }
      return { ...f, possible_solutions: sols }
    })
  }

  function removeSolution(i: number) {
    setForm(f => ({ ...f, possible_solutions: f.possible_solutions.filter((_, j) => j !== i) }))
  }

  async function runAiAnalysis(item: RfiTq) {
    setAiLoading(item.id)
    setAiError(e => ({ ...e, [item.id]: '' }))
    try {
      const r = await fetch(`/api/projects/${projectId}/rfi-tq/${item.id}/analyse`, { method: 'POST' })
      const d = await r.json()
      if (!r.ok) { setAiError(e => ({ ...e, [item.id]: d.error ?? 'Analysis failed' })); return }
      setAiResults(prev => ({ ...prev, [item.id]: d }))
      // Also update the item in list with saved analysis
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, ai_analysis: d, ai_analysed_at: new Date().toISOString() } : i))
    } finally {
      setAiLoading(null)
    }
  }

  async function loadAttachments(rfiId: string) {
    const r = await fetch(`/api/projects/${projectId}/rfi-tq/${rfiId}/attachments`)
    if (r.ok) { const d = await r.json(); setAttachments(prev => ({ ...prev, [rfiId]: d })) }
  }

  async function uploadAttachment(rfiId: string, file: File) {
    setAttachUploading(prev => ({ ...prev, [rfiId]: true }))
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch(`/api/projects/${projectId}/rfi-tq/${rfiId}/attachments`, { method: 'POST', body: fd })
      if (r.ok) await loadAttachments(rfiId)
    } finally {
      setAttachUploading(prev => ({ ...prev, [rfiId]: false }))
    }
  }

  async function deleteAttachment(rfiId: string, attId: string) {
    await fetch(`/api/projects/${projectId}/rfi-tq/${rfiId}/attachments/${attId}`, { method: 'DELETE' })
    await loadAttachments(rfiId)
  }

  async function downloadAttachment(rfiId: string, attId: string, fileName: string) {
    const r = await fetch(`/api/projects/${projectId}/rfi-tq/${rfiId}/attachments/${attId}`)
    if (!r.ok) return
    const { url } = await r.json()
    const a = document.createElement('a')
    a.href = url; a.download = fileName; a.click()
  }

  function getAiResult(item: RfiTq): AiAnalysis | null {
    return aiResults[item.id] ?? item.ai_analysis ?? null
  }

  const inputCls = `w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1`
  const inputStyle = { background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {openCount} open
          </span>
          {items.some(i => i.status === 'closed') && (
            <button
              onClick={() => setShowClosed(s => !s)}
              className="text-xs px-2 py-1 rounded border hover:opacity-80"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
            >
              {showClosed ? 'Hide closed' : 'Show closed'}
            </button>
          )}
        </div>
        {canEdit && (
          <button
            onClick={openNewForm}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Plus size={13} /> New RFI / TQ
          </button>
        )}
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>
          No {showClosed ? '' : 'open '}RFIs or TQs yet.
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map(item => {
            const sc = STATUS_COLOR[item.status]
            const overdue = slaOverdue(item)
            const days = daysUntilSla(item)
            const isOpen = expanded === item.id

            return (
              <div key={item.id} className="rounded-xl border overflow-hidden"
                style={{ borderColor: overdue ? 'rgba(239,68,68,0.4)' : 'var(--border)', background: 'var(--bg-surface)' }}>

                {/* Row header */}
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:opacity-90"
                  onClick={() => setExpanded(isOpen ? null : item.id)}>
                  <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>

                  <span className="text-xs font-mono px-2 py-0.5 rounded border shrink-0"
                    style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                    {item.type}
                  </span>

                  <span className="text-xs font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {item.number}
                  </span>

                  <span className="text-sm font-medium truncate flex-1" style={{ color: 'var(--text-primary)' }}>
                    {item.title}
                  </span>

                  {overdue && (
                    <span className="flex items-center gap-1 text-xs shrink-0" style={{ color: '#ef4444' }}>
                      <AlertCircle size={12} /> Overdue
                    </span>
                  )}
                  {!overdue && days !== null && item.status === 'submitted' && (
                    <span className="flex items-center gap-1 text-xs shrink-0" style={{ color: days <= 2 ? '#fb923c' : 'var(--text-muted)' }}>
                      <Clock size={12} /> {days}d left
                    </span>
                  )}

                  <span className="text-xs px-2 py-0.5 rounded-full border shrink-0"
                    style={{ background: sc.bg, color: sc.text, borderColor: sc.border }}>
                    {STATUS_LABELS[item.status]}
                  </span>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t px-4 py-4 space-y-5" style={{ borderColor: 'var(--border)' }}>

                    {/* Workflow stepper */}
                    <div className="flex items-center gap-0 flex-wrap">
                      {STATUS_ORDER.map((s, i) => {
                        const reached = STATUS_ORDER.indexOf(item.status) >= i
                        const current = item.status === s
                        const col = STATUS_COLOR[s]
                        return (
                          <div key={s} className="flex items-center">
                            <div className={`text-xs px-2.5 py-1 rounded-full border`}
                              style={{
                                background: reached ? col.bg : 'transparent',
                                color: reached ? col.text : 'var(--text-muted)',
                                borderColor: reached ? col.border : 'var(--border)',
                                fontWeight: current ? 700 : 400,
                              }}>
                              {STATUS_LABELS[s]}
                            </div>
                            {i < STATUS_ORDER.length - 1 && (
                              <div className="w-4 h-px mx-1" style={{ background: 'var(--border)' }} />
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Timestamps */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {item.date_sent && <span>Date sent: {fmt(item.date_sent)}</span>}
                      {item.date_received && <span>Date received: {fmt(item.date_received)}</span>}
                      {item.submitted_to_client_at && <span>Submitted: {fmt(item.submitted_to_client_at)}</span>}
                      {item.sla_expires_at && <span className={overdue ? 'font-semibold' : ''} style={{ color: overdue ? '#ef4444' : undefined }}>
                        SLA expires: {fmt(item.sla_expires_at)}
                      </span>}
                      {item.response_received_at && <span>Response received: {fmt(item.response_received_at)}</span>}
                      {item.sent_to_team_at && <span>Sent to team: {fmt(item.sent_to_team_at)}</span>}
                      {item.response_required_by && <span>Response required by: {fmt(item.response_required_by)}</span>}
                    </div>

                    {/* Contacts */}
                    {(item.to_contact || item.from_contact) && (
                      <div className="text-xs space-y-0.5" style={{ color: 'var(--text-muted)' }}>
                        {item.to_contact && <div><span className="font-medium">To:</span> {item.to_contact}</div>}
                        {item.from_contact && <div><span className="font-medium">From:</span> {item.from_contact}</div>}
                        {item.contractor_name && <div><span className="font-medium">Contractor:</span> {item.contractor_name}</div>}
                      </div>
                    )}

                    {/* Document ref */}
                    {(item.document_reference || item.document_title) && (
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {item.document_title && <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.document_title}</div>}
                        {item.document_reference && <div>{item.document_reference}</div>}
                      </div>
                    )}

                    {/* Description */}
                    {item.description && (
                      <div>
                        <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Query / Description</p>
                        <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{item.description}</p>
                      </div>
                    )}

                    {/* Possible solutions */}
                    {item.possible_solutions && item.possible_solutions.length > 0 && (
                      <div>
                        <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Possible Solutions</p>
                        <div className="space-y-2">
                          {item.possible_solutions.map((s, i) => (
                            <div key={i} className="rounded-lg border p-3 text-xs" style={{ borderColor: 'var(--border)' }}>
                              <p style={{ color: 'var(--text-primary)' }}>{s.solution}</p>
                              {(s.cost_impact || s.programme_impact) && (
                                <div className="mt-1 flex gap-4" style={{ color: 'var(--text-muted)' }}>
                                  {s.cost_impact && <span>Cost: {s.cost_impact}</span>}
                                  {s.programme_impact && <span>Programme: {s.programme_impact}</span>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Proposed solution */}
                    {item.proposed_solution && (
                      <div>
                        <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Proposed Solution</p>
                        <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{item.proposed_solution}</p>
                        <div className="mt-1 flex gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {item.cost_impact && <span>Cost impact: {item.cost_impact}</span>}
                          {item.programme_impact && <span>Programme impact: {item.programme_impact}</span>}
                          <span>Scope change: {item.is_scope_change ? 'Yes' : 'No'}</span>
                        </div>
                      </div>
                    )}

                    {/* Client response */}
                    {item.client_response && (
                      <div>
                        <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Client Response</p>
                        <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{item.client_response}</p>
                      </div>
                    )}

                    {/* ── Attachments panel ── */}
                    <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                      <button
                        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:opacity-80"
                        style={{ background: 'var(--bg-base)', color: 'var(--text-muted)' }}
                        onClick={() => {
                          if (showAttachPanel !== item.id) {
                            setShowAttachPanel(item.id)
                            if (!attachments[item.id]) loadAttachments(item.id)
                          } else {
                            setShowAttachPanel(null)
                          }
                        }}>
                        <span className="flex items-center gap-1.5">
                          <Paperclip size={12} /> Documents
                          {(attachments[item.id] ?? []).length > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px]"
                              style={{ background: 'var(--accent)', color: '#fff' }}>
                              {attachments[item.id].length}
                            </span>
                          )}
                        </span>
                        <span>{showAttachPanel === item.id ? '▲' : '▼'}</span>
                      </button>

                      {showAttachPanel === item.id && (
                        <div className="p-3 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
                          {/* Upload area */}
                          {canEdit && (
                            <label className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed py-4 cursor-pointer hover:opacity-80"
                              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                              {attachUploading[item.id]
                                ? <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                                : <><Upload size={14} /> <span className="text-xs">Upload PDF, DOCX, drawing…</span></>
                              }
                              <input type="file" className="hidden"
                                accept=".pdf,.docx,.doc,.xls,.xlsx,.dwg,.png,.jpg"
                                onChange={e => { const f = e.target.files?.[0]; if (f) uploadAttachment(item.id, f) }}
                              />
                            </label>
                          )}

                          {/* File list */}
                          {(attachments[item.id] ?? []).length === 0 && !attachUploading[item.id] && (
                            <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>
                              No documents attached yet
                            </p>
                          )}
                          {(attachments[item.id] ?? []).map(att => (
                            <div key={att.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                              style={{ background: 'var(--bg-base)' }}>
                              <FileText size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                              <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{att.file_name}</span>
                              {att.size_bytes && (
                                <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>
                                  {(att.size_bytes / 1024).toFixed(0)}KB
                                </span>
                              )}
                              <button onClick={() => downloadAttachment(item.id, att.id, att.file_name)}
                                className="hover:opacity-70 shrink-0" title="Download">
                                <Download size={12} style={{ color: 'var(--text-muted)' }} />
                              </button>
                              {canEdit && (
                                <button onClick={() => deleteAttachment(item.id, att.id)}
                                  className="hover:opacity-70 shrink-0" title="Delete">
                                  <Trash2 size={12} style={{ color: '#ef4444' }} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* ── AI Analysis panel ── */}
                    {(() => {
                      const result = getAiResult(item)
                      const isLoading = aiLoading === item.id
                      const err = aiError[item.id]

                      const CONF_COLOR = { high: '#22c55e', medium: '#f59e0b', low: '#fb923c', none: '#94a3b8' }
                      const FOUND_COLOR = result?.found_in_documents ? '#22c55e' : '#94a3b8'

                      return (
                        <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'rgba(139,92,246,0.3)' }}>
                          <div className="flex items-center justify-between px-3 py-2"
                            style={{ background: 'rgba(139,92,246,0.08)' }}>
                            <div className="flex items-center gap-2">
                              <Sparkles size={13} style={{ color: '#a78bfa' }} />
                              <span className="text-xs font-medium" style={{ color: '#a78bfa' }}>AI Analysis</span>
                              {item.ai_analysed_at && !aiResults[item.id] && (
                                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                  {fmt(item.ai_analysed_at)}
                                </span>
                              )}
                              {result && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full border"
                                  style={{ color: FOUND_COLOR, borderColor: FOUND_COLOR + '44', background: FOUND_COLOR + '15' }}>
                                  {result.found_in_documents ? 'Answer found in docs' : 'No direct match — AI analysis'}
                                </span>
                              )}
                            </div>
                            <button
                              disabled={isLoading}
                              onClick={() => runAiAnalysis(item)}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium hover:opacity-80 disabled:opacity-50"
                              style={{ background: '#7c3aed', color: '#fff' }}>
                              {isLoading
                                ? <><Loader2 size={11} className="animate-spin" /> Analysing…</>
                                : <><Sparkles size={11} /> {result ? 'Re-run' : 'Run AI Check'}</>
                              }
                            </button>
                          </div>

                          {err && (
                            <p className="px-3 py-2 text-xs" style={{ color: '#ef4444' }}>{err}</p>
                          )}

                          {isLoading && (
                            <div className="px-4 py-6 flex flex-col items-center gap-3">
                              <Loader2 size={20} className="animate-spin" style={{ color: '#a78bfa' }} />
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                Reading ER, project documents and attachments…
                              </p>
                            </div>
                          )}

                          {result && !isLoading && (
                            <div className="p-4 space-y-4">
                              {/* Summary + confidence */}
                              <div className="flex items-start gap-3">
                                <div className="flex-1">
                                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{result.summary}</p>
                                  {result.docs_searched !== undefined && (
                                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                      Searched {result.docs_searched} document{result.docs_searched !== 1 ? 's' : ''}
                                      {result.doc_labels && result.doc_labels.length > 0 ? `: ${result.doc_labels.join(', ')}` : ''}
                                    </p>
                                  )}
                                </div>
                                <span className="text-xs px-2 py-0.5 rounded-full border shrink-0"
                                  style={{ color: CONF_COLOR[result.confidence] ?? '#94a3b8', borderColor: (CONF_COLOR[result.confidence] ?? '#94a3b8') + '44', background: (CONF_COLOR[result.confidence] ?? '#94a3b8') + '15' }}>
                                  {result.confidence} confidence
                                </span>
                              </div>

                              {/* Verbatim quotes from docs */}
                              {result.sources && result.sources.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>Found in documents</p>
                                  {result.sources.map((src, i) => (
                                    <div key={i} className="rounded-lg border-l-2 pl-3 py-2" style={{ borderColor: '#22c55e' }}>
                                      <p className="text-[10px] font-medium mb-1" style={{ color: '#22c55e' }}>
                                        {src.document}{src.clause_ref ? ` · ${src.clause_ref}` : ''}
                                      </p>
                                      <blockquote className="text-xs italic mb-1" style={{ color: 'var(--text-primary)' }}>
                                        "{src.verbatim_text}"
                                      </blockquote>
                                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{src.relevance}</p>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Technical analysis */}
                              {result.technical_analysis && (
                                <div>
                                  <p className="text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Technical Analysis</p>
                                  <p className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-primary)' }}>{result.technical_analysis}</p>
                                </div>
                              )}

                              {/* Suggested response */}
                              {result.suggested_response && (
                                <div className="rounded-lg border p-3" style={{ borderColor: 'rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.06)' }}>
                                  <p className="text-[10px] uppercase tracking-wide font-semibold mb-2" style={{ color: '#a78bfa' }}>Suggested Response</p>
                                  <p className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-primary)' }}>{result.suggested_response}</p>
                                  <button
                                    className="mt-2 text-[10px] hover:opacity-70"
                                    style={{ color: '#a78bfa' }}
                                    onClick={() => navigator.clipboard.writeText(result.suggested_response)}>
                                    Copy to clipboard
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {!result && !isLoading && !err && (
                            <p className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                              Run the AI check to search the ER and project documents for a suggested response.
                            </p>
                          )}
                        </div>
                      )
                    })()}

                    {/* Action buttons */}
                    {canEdit && item.status !== 'closed' && (
                      <div className="flex flex-wrap gap-2 pt-1">

                        {item.status === 'received' && (
                          <button
                            onClick={() => { setSlaModal({ item }); setSlaValue(5) }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80"
                            style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.3)' }}>
                            <Clock size={12} /> Submit to Client
                          </button>
                        )}

                        {item.status === 'submitted' && (
                          <button
                            onClick={() => { setResponseModal({ item }); setResponseText('') }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80"
                            style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
                            <CheckCircle2 size={12} /> Log Response Received
                          </button>
                        )}

                        {item.status === 'response_received' && (
                          <button
                            onClick={() => advanceStatus(item, 'sent_to_team')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80"
                            style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)' }}>
                            <CheckCircle2 size={12} /> Mark Sent to Team
                          </button>
                        )}

                        {item.status === 'sent_to_team' && (
                          <button
                            onClick={() => advanceStatus(item, 'closed')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80"
                            style={{ background: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)' }}>
                            <CheckCircle2 size={12} /> Close
                          </button>
                        )}

                        <button
                          onClick={() => openEditForm(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs hover:opacity-80"
                          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                          <Pencil size={12} /> Edit
                        </button>

                        <button
                          onClick={() => loadAudit(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs hover:opacity-80"
                          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                          <History size={12} /> Audit trail
                        </button>
                      </div>
                    )}

                    {/* Reopen closed */}
                    {item.status === 'closed' && canEdit && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => advanceStatus(item, 'sent_to_team')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs hover:opacity-80"
                          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                          <RotateCcw size={12} /> Reopen
                        </button>
                        <button
                          onClick={() => loadAudit(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs hover:opacity-80"
                          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                          <History size={12} /> Audit trail
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── SLA modal ── */}
      {slaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-2xl border p-6 w-full max-w-sm space-y-4"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Submit to Client</h3>
              <button onClick={() => setSlaModal(null)}><X size={16} style={{ color: 'var(--text-muted)' }} /></button>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              How many days does the client have to respond?
            </p>
            <div className="flex gap-2 flex-wrap">
              {SLA_OPTIONS.map(d => (
                <button key={d} onClick={() => setSlaValue(d)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border hover:opacity-80"
                  style={{
                    background: slaValue === d ? 'var(--accent)' : 'transparent',
                    color: slaValue === d ? '#fff' : 'var(--text-primary)',
                    borderColor: slaValue === d ? 'var(--accent)' : 'var(--border)',
                  }}>
                  {d} {d === 1 ? 'day' : 'days'}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setSlaModal(null)}
                className="flex-1 py-2 rounded-lg text-xs border hover:opacity-80"
                style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                Cancel
              </button>
              <button
                onClick={async () => {
                  await advanceStatus(slaModal.item, 'submitted', { response_sla_days: slaValue })
                  setSlaModal(null)
                }}
                className="flex-1 py-2 rounded-lg text-xs font-medium hover:opacity-80"
                style={{ background: 'var(--accent)', color: '#fff' }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Response modal ── */}
      {responseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-2xl border p-6 w-full max-w-lg space-y-4"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Log Client Response</h3>
              <button onClick={() => setResponseModal(null)}><X size={16} style={{ color: 'var(--text-muted)' }} /></button>
            </div>
            <textarea
              className={inputCls}
              style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }}
              placeholder="Paste or type the client's response (Part 4)…"
              value={responseText}
              onChange={e => setResponseText(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={() => setResponseModal(null)}
                className="flex-1 py-2 rounded-lg text-xs border hover:opacity-80"
                style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                Cancel
              </button>
              <button
                onClick={async () => {
                  await advanceStatus(responseModal.item, 'response_received', { client_response: responseText || null })
                  setResponseModal(null)
                }}
                className="flex-1 py-2 rounded-lg text-xs font-medium hover:opacity-80"
                style={{ background: '#22c55e', color: '#fff' }}>
                Save Response
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Audit trail modal ── */}
      {auditItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-2xl border p-6 w-full max-w-2xl max-h-[80vh] flex flex-col"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Audit Trail</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{auditItem.number} — {auditItem.title}</p>
              </div>
              <button onClick={() => setAuditItem(null)}><X size={16} style={{ color: 'var(--text-muted)' }} /></button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-3">
              {(auditItem.audit_log ?? []).length === 0 && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No audit entries yet.</p>
              )}
              {(auditItem.audit_log ?? []).map(entry => (
                <div key={entry.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                      {entry.user_name}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(entry.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
                    {entry.action.replace(/_/g, ' ')}
                  </p>
                  {entry.changes && entry.changes.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {entry.changes.map((c, i) => (
                        <div key={i} className="text-xs rounded px-2 py-1" style={{ background: 'var(--bg-base)' }}>
                          <span className="font-medium" style={{ color: 'var(--text-muted)' }}>{fmtField(c.field)}: </span>
                          <span style={{ color: '#ef4444' }}>{fmtVal(c.old_value)}</span>
                          <span style={{ color: 'var(--text-muted)' }}> → </span>
                          <span style={{ color: '#22c55e' }}>{fmtVal(c.new_value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit form modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-2xl border w-full max-w-2xl max-h-[90vh] flex flex-col"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>

            <div className="flex items-center justify-between p-6 pb-4 border-b shrink-0"
              style={{ borderColor: 'var(--border)' }}>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                {editingItem ? `Edit ${editingItem.number}` : 'New RFI / TQ'}
              </h3>
              <button onClick={() => setShowForm(false)}><X size={16} style={{ color: 'var(--text-muted)' }} /></button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-4">

              {/* Type + Number */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Type</label>
                  <select className={inputCls} style={inputStyle} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as 'RFI' | 'TQ' }))}>
                    <option value="TQ">TQ</option>
                    <option value="RFI">RFI</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Number *</label>
                  <input className={inputCls} style={inputStyle} placeholder="e.g. SHAPE-KILW-TQ-005"
                    value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} />
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Title *</label>
                <input className={inputCls} style={inputStyle} placeholder="Short descriptive title"
                  value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>

              {/* Contacts */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>To (Client contact)</label>
                  <input className={inputCls} style={inputStyle} placeholder="e.g. Calum Burns"
                    value={form.to_contact} onChange={e => setForm(f => ({ ...f, to_contact: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>From (Contractor)</label>
                  <input className={inputCls} style={inputStyle} placeholder="e.g. Stephen Lynch"
                    value={form.from_contact} onChange={e => setForm(f => ({ ...f, from_contact: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Contractor name</label>
                <input className={inputCls} style={inputStyle} placeholder="e.g. SHAPE"
                  value={form.contractor_name} onChange={e => setForm(f => ({ ...f, contractor_name: e.target.value }))} />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Date Sent</label>
                  <input type="date" className={inputCls} style={inputStyle}
                    value={form.date_sent} onChange={e => setForm(f => ({ ...f, date_sent: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Date Received by Project</label>
                  <input type="date" className={inputCls} style={inputStyle}
                    value={form.date_received} onChange={e => setForm(f => ({ ...f, date_received: e.target.value }))} />
                </div>
              </div>

              {/* Document ref */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Document Reference</label>
                  <input className={inputCls} style={inputStyle} placeholder="Document ref / drawing no."
                    value={form.document_reference} onChange={e => setForm(f => ({ ...f, document_reference: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Document Title</label>
                  <input className={inputCls} style={inputStyle} placeholder="Title of referenced document"
                    value={form.document_title} onChange={e => setForm(f => ({ ...f, document_title: e.target.value }))} />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Detailed Query / Description (Part 1)</label>
                <textarea className={inputCls} style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }}
                  placeholder="Full description of the query, including any numbered questions…"
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              {/* Possible solutions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Possible Solutions (Part 2)</label>
                  <button onClick={addSolution} className="text-xs hover:opacity-80" style={{ color: 'var(--accent)' }}>
                    + Add solution
                  </button>
                </div>
                {form.possible_solutions.map((sol, i) => (
                  <div key={i} className="rounded-lg border p-3 mb-2 space-y-2" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-start gap-2">
                      <textarea className={`${inputCls} flex-1`} style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                        placeholder="Solution description"
                        value={sol.solution} onChange={e => updateSolution(i, 'solution', e.target.value)} />
                      <button onClick={() => removeSolution(i)} className="mt-1 hover:opacity-70"><X size={13} style={{ color: 'var(--text-muted)' }} /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input className={inputCls} style={inputStyle} placeholder="Cost impact"
                        value={sol.cost_impact} onChange={e => updateSolution(i, 'cost_impact', e.target.value)} />
                      <input className={inputCls} style={inputStyle} placeholder="Programme impact"
                        value={sol.programme_impact} onChange={e => updateSolution(i, 'programme_impact', e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Proposed solution */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Proposed Solution (Part 3)</label>
                <textarea className={inputCls} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                  placeholder="Contractor's proposed solution with rationale…"
                  value={form.proposed_solution} onChange={e => setForm(f => ({ ...f, proposed_solution: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Estimated Cost Impact</label>
                  <input className={inputCls} style={inputStyle} placeholder="e.g. N/A or £X"
                    value={form.cost_impact} onChange={e => setForm(f => ({ ...f, cost_impact: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Estimated Programme Impact</label>
                  <input className={inputCls} style={inputStyle} placeholder="e.g. N/A or X days"
                    value={form.programme_impact} onChange={e => setForm(f => ({ ...f, programme_impact: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Response Required By</label>
                  <input type="date" className={inputCls} style={inputStyle}
                    value={form.response_required_by} onChange={e => setForm(f => ({ ...f, response_required_by: e.target.value }))} />
                </div>
                <div className="flex items-end pb-0.5">
                  <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                    <input type="checkbox" checked={form.is_scope_change} onChange={e => setForm(f => ({ ...f, is_scope_change: e.target.checked }))} />
                    Change to scope of work
                  </label>
                </div>
              </div>

              {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}
            </div>

            <div className="flex gap-2 p-6 pt-4 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-lg text-sm border hover:opacity-80"
                style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                Cancel
              </button>
              <button onClick={saveForm} disabled={saving}
                className="flex-1 py-2 rounded-lg text-sm font-medium hover:opacity-80 disabled:opacity-50"
                style={{ background: 'var(--accent)', color: '#fff' }}>
                {saving ? 'Saving…' : editingItem ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
