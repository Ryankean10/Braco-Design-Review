'use client'

import { useState, useCallback } from 'react'
import { X, Plus } from 'lucide-react'

interface Person    { id: string; name: string; role: string }
interface Project   { id: string; name: string }
interface Assignment {
  id: string
  person_id: string
  project_id: string | null
  site_id: string | null
  assign_date: string
  role_on_day: string | null
  notes: string | null
}

interface Props {
  people: Person[]
  projects: Project[]
  assignments: Assignment[]
  startDate: string
  companyId: string
  canEdit: boolean
}

function addDays(base: string, n: number) {
  const d = new Date(base + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function fmtDay(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })
}

const ACCENT_COLOURS = [
  '#60a5fa', '#34d399', '#a78bfa', '#fb923c', '#f472b6',
  '#facc15', '#38bdf8', '#4ade80', '#c084fc', '#fd8a3a',
]

export default function ResourceScheduleClient({ people, projects, assignments: initial, startDate, companyId, canEdit }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>(initial)
  const [popover, setPopover] = useState<{ personId: string; date: string } | null>(null)
  const [selectedProject, setSelectedProject] = useState('')
  const [saving, setSaving] = useState(false)

  const days = Array.from({ length: 14 }, (_, i) => addDays(startDate, i))

  const projectColorMap: Record<string, string> = {}
  projects.forEach((p, i) => { projectColorMap[p.id] = ACCENT_COLOURS[i % ACCENT_COLOURS.length] })

  function getCell(personId: string, date: string) {
    return assignments.filter(a => a.person_id === personId && a.assign_date === date)
  }

  function isClash(personId: string, date: string) {
    return getCell(personId, date).length > 1
  }

  async function addAssignment() {
    if (!popover || !selectedProject) return
    setSaving(true)
    try {
      const res = await fetch('/api/resource-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          person_id: popover.personId,
          project_id: selectedProject,
          assign_date: popover.date,
        }),
      })
      if (res.ok) {
        const row = await res.json()
        setAssignments(prev => [...prev, row])
        setPopover(null)
        setSelectedProject('')
      }
    } finally {
      setSaving(false)
    }
  }

  async function removeAssignment(id: string) {
    await fetch(`/api/resource-assignments/${id}`, { method: 'DELETE' })
    setAssignments(prev => prev.filter(a => a.id !== id))
  }

  const openPopover = useCallback((personId: string, date: string) => {
    if (!canEdit) return
    setPopover({ personId, date })
    setSelectedProject('')
  }, [canEdit])

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-xs" style={{ minWidth: 900 }}>
        <thead>
          <tr>
            <th className="text-left px-3 py-2 font-semibold sticky left-0 z-10 min-w-[140px]"
              style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              Person
            </th>
            {days.map(d => {
              const isWeekend = [0, 6].includes(new Date(d + 'T00:00:00').getDay())
              return (
                <th key={d} className="px-2 py-2 font-medium text-center min-w-[90px]"
                  style={{
                    background: isWeekend ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                    borderBottom: '1px solid var(--border)',
                    color: isWeekend ? 'var(--text-muted)' : 'var(--text-primary)',
                    fontSize: 10,
                  }}>
                  {fmtDay(d)}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {people.map(person => (
            <tr key={person.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
              <td className="px-3 py-2 sticky left-0 z-10"
                style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', verticalAlign: 'middle' }}>
                <p className="font-medium truncate max-w-[130px]">{person.name}</p>
                <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{person.role}</p>
              </td>
              {days.map(d => {
                const cell = getCell(person.id, d)
                const clash = isClash(person.id, d)
                const isWeekend = [0, 6].includes(new Date(d + 'T00:00:00').getDay())
                return (
                  <td key={d} className="p-1 relative align-top"
                    style={{ background: isWeekend ? 'rgba(0,0,0,0.04)' : 'transparent', minHeight: 48 }}>
                    <div className="flex flex-col gap-1 min-h-[40px]">
                      {cell.map(a => {
                        const proj = projects.find(p => p.id === a.project_id)
                        const color = a.project_id ? (projectColorMap[a.project_id] ?? '#94a3b8') : '#94a3b8'
                        return (
                          <div key={a.id}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium group"
                            style={{
                              background: clash ? 'rgba(248,113,113,0.15)' : `${color}20`,
                              color: clash ? '#f87171' : color,
                              border: `1px solid ${clash ? 'rgba(248,113,113,0.4)' : `${color}50`}`,
                            }}>
                            <span className="truncate max-w-[64px]" title={proj?.name ?? 'Unknown'}>
                              {proj?.name ?? '?'}
                            </span>
                            {canEdit && (
                              <button
                                onClick={() => removeAssignment(a.id)}
                                className="opacity-0 group-hover:opacity-100 ml-auto shrink-0"
                                style={{ color: clash ? '#f87171' : color }}>
                                <X size={9} />
                              </button>
                            )}
                          </div>
                        )
                      })}
                      {canEdit && (
                        <button
                          onClick={() => openPopover(person.id, d)}
                          className="opacity-0 hover:opacity-100 focus:opacity-100 w-full rounded flex items-center justify-center transition-opacity"
                          style={{ color: 'var(--text-muted)', height: cell.length === 0 ? 40 : 16 }}>
                          <Plus size={10} />
                        </button>
                      )}
                    </div>
                    {clash && (
                      <p className="text-[9px] font-bold mt-0.5 text-center" style={{ color: '#f87171' }}>CLASH</p>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add popover */}
      {popover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl shadow-2xl w-full max-w-xs p-5 space-y-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Assign to project</p>
              <button onClick={() => setPopover(null)} style={{ color: 'var(--text-muted)' }}><X size={14} /></button>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {people.find(p => p.id === popover.personId)?.name} · {fmtDay(popover.date)}
            </p>
            <select
              value={selectedProject}
              onChange={e => setSelectedProject(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: selectedProject ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              <option value="">Select project…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setPopover(null)} className="flex-1 py-2 rounded-lg text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                Cancel
              </button>
              <button onClick={addAssignment} disabled={!selectedProject || saving}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: 'var(--accent)' }}>
                {saving ? 'Saving…' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
