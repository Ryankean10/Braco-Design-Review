'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2, Circle, Clock, PauseCircle, ChevronDown, ChevronRight,
  CheckSquare, Square, PenLine, AlertCircle, Lock, HardHat
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ProjectStage, StageStatus, ChecklistItem, AnyStage } from '@/lib/stageDefaults'

const STATUS_CFG: Record<StageStatus, { color: string; bg: string; border: string; icon: React.ReactNode; label: string }> = {
  'Not Started': { color: '#64748b', bg: 'rgba(100,116,139,0.1)',  border: 'rgba(100,116,139,0.3)', icon: <Circle size={13} />,       label: 'Not Started' },
  'In Progress': { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.35)', icon: <Clock size={13} />,        label: 'In Progress' },
  'Complete':    { color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.35)', icon: <CheckCircle2 size={13} />, label: 'Complete'    },
  'On Hold':     { color: '#fb923c', bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.35)', icon: <PauseCircle size={13} />,  label: 'On Hold'     },
}

// Gate stages require sign-off before project can progress
const GATE_STAGES: AnyStage[] = ['Feasibility', 'Energise & Handover', 'Awarded', 'Handover']

interface Props {
  stages: ProjectStage[]
  canEdit: boolean
  userId: string
  userName: string
  projectId: string
}

export default function ProjectStageTracker({ stages: initStages, canEdit, userId, userName, projectId }: Props) {
  const [stages, setStages] = useState<ProjectStage[]>(initStages)
  const [expanded, setExpanded] = useState<AnyStage | null>(null)
  const [signingOff, setSigningOff] = useState<AnyStage | null>(null)
  const [signOffNotes, setSignOffNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [constructionSiteId, setConstructionSiteId] = useState<string | null>(null)
  const supabase = createClient()

  function getStage(name: AnyStage) {
    return stages.find(s => s.stage === name)!
  }

  function updateStageLocal(name: AnyStage, patch: Partial<ProjectStage>) {
    setStages(prev => prev.map(s => s.stage === name ? { ...s, ...patch } : s))
  }

  async function saveStage(name: AnyStage, patch: Partial<ProjectStage>) {
    const stage = getStage(name)
    const { data } = await supabase
      .from('project_stages')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', stage.id)
      .select()
      .single()
    if (data) updateStageLocal(name, data)
  }

  async function setStatus(name: AnyStage, status: StageStatus) {
    if (!canEdit) return
    setSaving(true)
    const now = new Date().toISOString()
    const patch: Partial<ProjectStage> = { status }
    if (status === 'In Progress' && !getStage(name).started_at) patch.started_at = now
    if (status === 'Complete') patch.completed_at = now
    else patch.completed_at = null
    await saveStage(name, patch)
    setSaving(false)
  }

  async function toggleChecklistItem(stageName: AnyStage, itemId: string) {
    if (!canEdit) return
    const stage = getStage(stageName)
    const now = new Date().toISOString()
    const newChecklist = stage.checklist.map(item =>
      item.id === itemId
        ? item.checked
          ? { ...item, checked: false, checked_by: null, checked_by_name: null, checked_at: null }
          : { ...item, checked: true, checked_by: userId, checked_by_name: userName, checked_at: now }
        : item
    )
    updateStageLocal(stageName, { checklist: newChecklist })
    await supabase.from('project_stages')
      .update({ checklist: newChecklist, updated_at: now })
      .eq('id', stage.id)
  }

  async function signOff(stageName: AnyStage) {
    if (!canEdit) return
    setSaving(true)
    const now = new Date().toISOString()
    await saveStage(stageName, {
      status: 'Complete',
      signed_off_by: userId,
      signed_off_at: now,
      sign_off_notes: signOffNotes.trim() || null,
      completed_at: now,
    })

    // Auto-provision construction site when Feasibility gate is signed off
    if (stageName === 'Feasibility') {
      const res = await fetch('/api/construction/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      if (res.ok) {
        const { siteId } = await res.json()
        setConstructionSiteId(siteId)
      }
    }

    setSigningOff(null)
    setSignOffNotes('')
    setSaving(false)
  }

  const fmtDate = (s: string | null) => s
    ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div className="space-y-3">
    {constructionSiteId && (
      <Link href={`/construction/${constructionSiteId}`}
        className="flex items-center gap-3 px-4 py-3 rounded-xl border text-sm hover:opacity-90 transition-opacity"
        style={{ background: 'rgba(74,222,128,0.08)', borderColor: 'rgba(74,222,128,0.4)', color: '#4ade80' }}>
        <HardHat size={16} />
        <span className="font-medium">Construction programme created</span>
        <span style={{ color: 'var(--text-muted)' }}>— click to open the construction module →</span>
      </Link>
    )}
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      {/* Header */}
      <div className="px-5 py-3 border-b flex items-center justify-between"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Project Stages</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Multiple stages can run concurrently
        </p>
      </div>

      {/* Stage pills row */}
      <div className="p-4 grid grid-cols-3 gap-2" style={{ background: 'var(--bg-elevated)' }}>
        {stages.map(stage => {
          const name = stage.stage as AnyStage
          const cfg = STATUS_CFG[stage.status]
          const done    = stage.checklist.filter(i => i.checked).length
          const total   = stage.checklist.length
          const pct     = total > 0 ? Math.round((done / total) * 100) : 0
          const isGate  = GATE_STAGES.includes(name)
          const isOpen  = expanded === name

          return (
            <button
              key={name}
              onClick={() => setExpanded(isOpen ? null : name)}
              className="rounded-xl border p-3 text-left hover:opacity-90 transition-opacity"
              style={{ borderColor: isOpen ? cfg.color : cfg.border, background: isOpen ? cfg.bg : 'var(--bg-surface)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5" style={{ color: cfg.color }}>
                  {cfg.icon}
                  <span className="text-[10px] font-semibold uppercase tracking-wide">{cfg.label}</span>
                </div>
                {isGate && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(108,114,245,0.15)', color: 'var(--accent)' }}>
                    Gate
                  </span>
                )}
                {isOpen ? <ChevronDown size={12} style={{ color: cfg.color }} /> : <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />}
              </div>
              <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>{name}</p>
              {/* Progress bar */}
              <div className="w-full h-1 rounded-full mb-1" style={{ background: 'var(--border)' }}>
                <div className="h-1 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: cfg.color }} />
              </div>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {done}/{total} items{stage.signed_off_at ? ` · Signed off ${fmtDate(stage.signed_off_at)}` : ''}
              </p>
            </button>
          )
        })}
      </div>

      {/* Expanded stage detail */}
      {expanded && (() => {
        const stage = getStage(expanded)
        const cfg   = STATUS_CFG[stage.status]
        const done  = stage.checklist.filter(i => i.checked).length
        const total = stage.checklist.length
        const allChecked = done === total && total > 0
        const isComplete = stage.status === 'Complete'

        return (
          <div className="border-t" style={{ borderColor: 'var(--border)' }}>
            {/* Stage header */}
            <div className="flex items-center justify-between px-5 py-3 border-b"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{expanded}</p>
                {stage.started_at && (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Started {fmtDate(stage.started_at)}
                    {stage.completed_at ? ` · Completed ${fmtDate(stage.completed_at)}` : ''}
                  </p>
                )}
              </div>
              {/* Status selector */}
              {canEdit && !isComplete && (
                <div className="flex gap-1.5">
                  {(['Not Started', 'In Progress', 'On Hold'] as StageStatus[]).map(s => {
                    const c = STATUS_CFG[s]
                    return (
                      <button key={s} onClick={() => setStatus(expanded, s)} disabled={saving}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-all"
                        style={{
                          color:        stage.status === s ? 'white' : c.color,
                          background:   stage.status === s ? c.color : 'transparent',
                          borderColor:  c.color,
                        }}>
                        {c.icon}{s}
                      </button>
                    )
                  })}
                </div>
              )}
              {isComplete && (
                <div className="flex items-center gap-1.5 text-xs" style={{ color: '#4ade80' }}>
                  <CheckCircle2 size={14} />
                  <span>Complete{stage.signed_off_at ? ` — signed off ${fmtDate(stage.signed_off_at)}` : ''}</span>
                </div>
              )}
            </div>

            {/* Sign-off banner (if signed off) */}
            {stage.signed_off_at && (
              <div className="px-5 py-3 flex items-start gap-3 border-b"
                style={{ background: 'rgba(74,222,128,0.06)', borderColor: 'rgba(74,222,128,0.2)' }}>
                <Lock size={13} className="mt-0.5 flex-shrink-0" style={{ color: '#4ade80' }} />
                <div className="text-xs" style={{ color: '#86efac' }}>
                  <span className="font-semibold">Stage signed off</span>
                  {stage.sign_off_notes && <span> — {stage.sign_off_notes}</span>}
                </div>
              </div>
            )}

            {/* Checklist */}
            <div className="px-5 py-4 space-y-2" style={{ background: 'var(--bg-elevated)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                Checklist — {done}/{total}
              </p>
              {stage.checklist.map(item => (
                <button
                  key={item.id}
                  onClick={() => !isComplete && toggleChecklistItem(expanded, item.id)}
                  disabled={isComplete || !canEdit}
                  className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-opacity hover:opacity-80 disabled:cursor-default"
                  style={{ background: item.checked ? 'rgba(74,222,128,0.07)' : 'var(--bg-surface)', border: `1px solid ${item.checked ? 'rgba(74,222,128,0.2)' : 'var(--border)'}` }}
                >
                  {item.checked
                    ? <CheckSquare size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#4ade80' }} />
                    : <Square size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" style={{ color: item.checked ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: item.checked ? 'line-through' : 'none' }}>
                      {item.label}
                    </p>
                    {item.checked && item.checked_by_name && (
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {item.checked_by_name} · {fmtDate(item.checked_at!)}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Sign-off section */}
            {canEdit && !isComplete && (
              <div className="px-5 pb-4" style={{ background: 'var(--bg-elevated)' }}>
                {!allChecked && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs"
                    style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)', color: '#fdba74' }}>
                    <AlertCircle size={12} />
                    {total - done} checklist item{total - done !== 1 ? 's' : ''} remaining before sign-off
                  </div>
                )}
                {allChecked && signingOff !== expanded && (
                  <button
                    onClick={() => setSigningOff(expanded)}
                    className="w-full py-2.5 rounded-xl text-sm font-medium text-white"
                    style={{ background: 'linear-gradient(135deg, #4ade80, #22c55e)' }}>
                    Sign Off & Mark Complete
                  </button>
                )}
                {signingOff === expanded && (
                  <div className="space-y-2 rounded-xl border p-4"
                    style={{ background: 'var(--bg-surface)', borderColor: 'rgba(74,222,128,0.3)' }}>
                    <p className="text-xs font-semibold" style={{ color: '#4ade80' }}>Sign off — {expanded}</p>
                    <textarea
                      value={signOffNotes}
                      onChange={e => setSignOffNotes(e.target.value)}
                      rows={2}
                      placeholder="Sign-off notes (optional) — any conditions, caveats or references"
                      className="w-full rounded-lg border px-3 py-2 text-sm resize-none"
                      style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setSigningOff(null)}
                        className="px-3 py-1.5 rounded-lg text-xs"
                        style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                        Cancel
                      </button>
                      <button onClick={() => signOff(expanded)} disabled={saving}
                        className="px-4 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-60"
                        style={{ background: '#22c55e' }}>
                        {saving ? 'Saving…' : 'Confirm Sign-off'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}
    </div>
    </div>
  )
}
