'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, Flag, ChevronDown, ChevronUp, Check, Clock, AlertCircle, Loader2, X } from 'lucide-react'

interface CableActivity {
  id: string
  activity: string
  end_side: string | null
  status: string
  completed_by: string | null
  completed_at: string | null
  needs_review: boolean
}

interface CableItem {
  id: string
  cable_ref: string
  description: string | null
  package_name: string
  from_unit: string | null
  from_location: string | null
  to_unit: string | null
  to_location: string | null
  cable_size: string | null
  num_cores: number | null
  length_m: number | null
  cable_type: string | null
  mvs: string | null
  battery: string | null
  area: string | null
  overall_status: string
  completion_pct: number
  flagged: boolean
  flag_reason: string | null
  notes: string | null
  containment_route: string | null
  cable_activities: CableActivity[]
}

interface Package {
  id: string
  name: string
}

interface Props {
  siteId: string
  initialCables: CableItem[]
  packages: Package[]
  canEdit: boolean
}

const STATUS_CFG: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  'Complete':    { color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  icon: <Check size={10} /> },
  'In Progress': { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  icon: <Clock size={10} /> },
  'Blocked':     { color: '#f87171', bg: 'rgba(248,113,113,0.12)', icon: <AlertCircle size={10} /> },
  'Rework':      { color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  icon: <AlertCircle size={10} /> },
  'Not Started': { color: '#475569', bg: 'rgba(71,85,105,0.12)',   icon: <Clock size={10} /> },
}

const ACT_ORDER = ['Pulled', 'Gland', 'Crimp', 'Terminate', 'Test', 'Torque', 'Dress', 'QCS',
                   'Fibre Pulled', 'Fibre Terminated', 'Fibre Tested', 'Label', 'Installed', 'Jointer']

function getActivityKey(act: CableActivity) {
  return `${act.activity}||${act.end_side ?? ''}`
}

export default function CableRegister({ siteId, initialCables, packages, canEdit }: Props) {
  const searchParams = useSearchParams()
  const [cables, setCables]       = useState<CableItem[]>(initialCables)
  const [search, setSearch]       = useState('')
  const [filterPkg, setFilterPkg] = useState<string>('all')
  const [filterMvs, setFilterMvs] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>(searchParams.get('status') ?? 'all')
  const [filterFlagged, setFilterFlagged] = useState(searchParams.get('flagged') === 'true')
  const [expanded, setExpanded]   = useState<Set<string>>(new Set())

  useEffect(() => {
    const status = searchParams.get('status')
    const flagged = searchParams.get('flagged')
    if (status !== null || flagged !== null) {
      setFilterStatus(status ?? 'all')
      setFilterFlagged(flagged === 'true')
      // Scroll after state update + paint
      requestAnimationFrame(() => {
        document.getElementById('cable-register')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [searchParams])
  const [saving, setSaving]       = useState<Set<string>>(new Set())

  // Derived filter options
  const mvsOptions = useMemo(() => {
    const s = new Set(cables.map(c => c.mvs).filter(Boolean) as string[])
    return Array.from(s).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [cables])

  const filtered = useMemo(() => {
    return cables.filter(c => {
      if (filterPkg !== 'all' && c.package_name !== filterPkg) return false
      if (filterMvs !== 'all' && c.mvs !== filterMvs) return false
      if (filterStatus !== 'all' && c.overall_status !== filterStatus) return false
      if (filterFlagged && !c.flagged) return false
      if (search) {
        const q = search.toLowerCase()
        const match =
          c.cable_ref.toLowerCase().includes(q) ||
          (c.from_unit ?? '').toLowerCase().includes(q) ||
          (c.to_unit ?? '').toLowerCase().includes(q) ||
          (c.cable_size ?? '').toLowerCase().includes(q) ||
          (c.description ?? '').toLowerCase().includes(q) ||
          (c.containment_route ?? '').toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })
  }, [cables, filterPkg, filterMvs, filterStatus, filterFlagged, search])

  async function toggleActivity(cable: CableItem, activity: string, endSide: string | null, currentStatus: string) {
    const nextStatus = currentStatus === 'Complete' ? 'Not Started' : 'Complete'
    const key = `${cable.id}||${activity}||${endSide ?? ''}`
    setSaving(prev => new Set(prev).add(key))

    const res = await fetch(`/api/construction/cables/${cable.id}/activity`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity, end_side: endSide, status: nextStatus }),
    })

    if (res.ok) {
      const updatedAct = await res.json()
      setCables(prev => prev.map(c => {
        if (c.id !== cable.id) return c
        const acts = c.cable_activities.map(a =>
          a.activity === activity && a.end_side === endSide ? { ...a, status: nextStatus } : a
        )
        // If activity didn't exist yet, add it
        if (!acts.find(a => a.activity === activity && a.end_side === endSide)) {
          acts.push({ ...updatedAct, activity, end_side: endSide, status: nextStatus, needs_review: false, completed_by: null, completed_at: null })
        }
        // Recompute pct
        const done = acts.filter(a => a.status === 'Complete').length
        const pct = done / acts.length
        const newStatus =
          pct === 1    ? 'Complete'    :
          pct > 0      ? 'In Progress' : 'Not Started'
        return { ...c, cable_activities: acts, completion_pct: pct, overall_status: newStatus }
      }))
    }
    setSaving(prev => { const n = new Set(prev); n.delete(key); return n })
  }

  async function toggleFlag(cable: CableItem) {
    const next = !cable.flagged
    await fetch(`/api/construction/cables/${cable.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flagged: next }),
    })
    setCables(prev => prev.map(c => c.id === cable.id ? { ...c, flagged: next } : c))
  }

  function toggleExpand(id: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const selectStyle = { background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)' }

  return (
    <div id="cable-register" className="space-y-4">
      {/* Search + filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search cable ref, from, to, size, containment…"
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}><X size={13} /></button>}
        </div>
        <select value={filterPkg} onChange={e => setFilterPkg(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm outline-none" style={selectStyle}>
          <option value="all">All packages</option>
          {packages.sort((a, b) => a.name.localeCompare(b.name)).map(p => (
            <option key={p.id} value={p.name}>{p.name}</option>
          ))}
        </select>
        {mvsOptions.length > 0 && (
          <select value={filterMvs} onChange={e => setFilterMvs(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm outline-none" style={selectStyle}>
            <option value="all">All MVS</option>
            {mvsOptions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm outline-none" style={selectStyle}>
          <option value="all">All statuses</option>
          {['Not Started', 'In Progress', 'Complete', 'Blocked', 'Rework'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          onClick={() => setFilterFlagged(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm"
          style={{ background: filterFlagged ? 'rgba(251,146,60,0.15)' : 'var(--bg-surface)', border: '1px solid var(--border)', color: filterFlagged ? '#fb923c' : 'var(--text-muted)' }}>
          <Flag size={13} /> Flagged
        </button>
        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
          {filtered.length} / {cables.length} cables
        </span>
      </div>

      {/* Column header */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <div className="grid grid-cols-12 px-4 py-2 text-xs font-medium border-b"
          style={{ color: 'var(--text-muted)', borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
          <span className="col-span-2">Cable ref</span>
          <span className="col-span-2">Package / MVS</span>
          <span className="col-span-2">From → To</span>
          <span className="col-span-1">Size</span>
          <span className="col-span-1">Length</span>
          <span className="col-span-2">Status</span>
          <span className="col-span-1">Progress</span>
          <span className="col-span-1 text-right">⋮</span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            No cables match the current filters
          </div>
        ) : (
          filtered.map(cable => {
            const cfg = STATUS_CFG[cable.overall_status] ?? STATUS_CFG['Not Started']
            const isOpen = expanded.has(cable.id)
            const pctDisplay = Math.round(cable.completion_pct * 100)

            return (
              <div key={cable.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                {/* Row */}
                <div className="grid grid-cols-12 px-4 py-2.5 items-center hover:opacity-90"
                  style={{ background: cable.flagged ? 'rgba(251,146,60,0.05)' : 'var(--bg-surface)' }}>
                  <div className="col-span-2 flex items-center gap-1.5">
                    {cable.flagged && <Flag size={11} style={{ color: '#fb923c', flexShrink: 0 }} />}
                    <span className="text-xs font-mono font-medium" style={{ color: 'var(--accent)' }}>{cable.cable_ref}</span>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{cable.package_name}</p>
                    {cable.mvs && <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{cable.mvs}{cable.battery ? ` · ${cable.battery}` : ''}</p>}
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>{cable.from_unit ?? '—'}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>→ {cable.to_unit ?? '—'}</p>
                  </div>
                  <span className="col-span-1 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{cable.cable_size ?? '—'}</span>
                  <span className="col-span-1 text-xs" style={{ color: 'var(--text-muted)' }}>{cable.length_m != null ? `${cable.length_m}m` : '—'}</span>
                  <div className="col-span-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                      style={{ color: cfg.color, background: cfg.bg }}>
                      {cfg.icon}{cable.overall_status}
                    </span>
                  </div>
                  <div className="col-span-1">
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pctDisplay}%`, background: cfg.color }} />
                      </div>
                      <span className="text-[10px] w-6 text-right" style={{ color: 'var(--text-muted)' }}>{pctDisplay}%</span>
                    </div>
                  </div>
                  <div className="col-span-1 flex justify-end items-center gap-1">
                    {canEdit && (
                      <button onClick={() => toggleFlag(cable)} title="Flag / unflag"
                        className="p-1 rounded hover:opacity-70"
                        style={{ color: cable.flagged ? '#fb923c' : 'var(--text-muted)' }}>
                        <Flag size={12} />
                      </button>
                    )}
                    <button onClick={() => toggleExpand(cable.id)}
                      className="p-1 rounded hover:opacity-70"
                      style={{ color: isOpen ? 'var(--accent)' : 'var(--text-muted)' }}>
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* Expanded activity panel */}
                {isOpen && (
                  <div className="px-4 py-3 border-t space-y-3"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
                    {/* Cable metadata */}
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {cable.cable_type && <span>Type: {cable.cable_type}</span>}
                      {cable.num_cores && <span>Cores: {cable.num_cores}</span>}
                      {cable.containment_route && <span>Containment: <span style={{ color: '#a78bfa' }}>{cable.containment_route}</span></span>}
                      {cable.notes && <span>Notes: {cable.notes}</span>}
                    </div>

                    {/* Activity checklist */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Activities</p>
                      <div className="flex flex-wrap gap-2">
                        {cable.cable_activities
                          .sort((a, b) => {
                            const ai = ACT_ORDER.indexOf(a.activity)
                            const bi = ACT_ORDER.indexOf(b.activity)
                            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
                          })
                          .map(act => {
                            const isDone  = act.status === 'Complete'
                            const isBlocked = act.status === 'Blocked'
                            const label = act.end_side ? `${act.activity} (${act.end_side.replace(' side', '')})` : act.activity
                            const key = `${cable.id}||${act.activity}||${act.end_side ?? ''}`
                            const isSaving = saving.has(key)

                            return (
                              <button
                                key={getActivityKey(act)}
                                onClick={() => canEdit && toggleActivity(cable, act.activity, act.end_side, act.status)}
                                disabled={!canEdit || isSaving}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all disabled:opacity-60"
                                style={{
                                  background: isDone ? 'rgba(74,222,128,0.15)' : isBlocked ? 'rgba(248,113,113,0.12)' : 'var(--bg-surface)',
                                  border: `1px solid ${isDone ? 'rgba(74,222,128,0.4)' : isBlocked ? 'rgba(248,113,113,0.3)' : 'var(--border)'}`,
                                  color: isDone ? '#4ade80' : isBlocked ? '#f87171' : 'var(--text-muted)',
                                  cursor: canEdit ? 'pointer' : 'default',
                                }}>
                                {isSaving
                                  ? <Loader2 size={10} className="animate-spin" />
                                  : isDone ? <Check size={10} /> : <Clock size={10} />}
                                {label}
                                {act.needs_review && <Flag size={9} style={{ color: '#fb923c' }} />}
                              </button>
                            )
                          })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
