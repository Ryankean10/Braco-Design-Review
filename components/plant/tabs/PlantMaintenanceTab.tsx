'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Wrench, Calendar, AlertTriangle } from 'lucide-react'
import type { PlantMaintenanceTask, PlantMaintenanceLog } from '@/lib/types'

interface Props {
  tasks: PlantMaintenanceTask[]
  logs: PlantMaintenanceLog[]
  plantId: string
  companyId: string
  canEdit: boolean
}

function daysUntil(dateStr: string | null) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

export default function PlantMaintenanceTab({ tasks, logs, plantId, companyId, canEdit }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'schedule' | 'log'>('schedule')
  const [showAddTask, setShowAddTask] = useState(false)
  const [showLogWork, setShowLogWork] = useState(false)
  const [saving, setSaving] = useState(false)

  const [taskForm, setTaskForm] = useState({
    title: '', description: '', interval_type: 'months', interval_value: '6',
    next_due_date: '', recurring: true,
  })

  const [logForm, setLogForm] = useState({
    task_id: '', description: '', carried_out_by: '',
    carried_out_date: new Date().toISOString().split('T')[0],
    labour_cost: '', parts_cost: '', downtime_hours: '', next_due_date: '', notes: '',
    parts: [] as { name: string; qty: string; cost: string }[],
  })

  async function saveTask(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch(`/api/plant/${plantId}/maintenance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'task', company_id: companyId, ...taskForm }),
    })
    setSaving(false)
    setShowAddTask(false)
    router.refresh()
  }

  async function saveLog(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const parts_used = logForm.parts.filter(p => p.name).map(p => ({ name: p.name, qty: Number(p.qty) || 1, cost: Number(p.cost) || 0 }))
    await fetch(`/api/plant/${plantId}/maintenance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'log', company_id: companyId, ...logForm, parts_used }),
    })
    setSaving(false)
    setShowLogWork(false)
    router.refresh()
  }

  const overdueTasks = tasks.filter(t => {
    const d = daysUntil(t.next_due_date)
    return d !== null && d <= 0
  })

  return (
    <div className="space-y-4">
      {overdueTasks.length > 0 && (
        <div className="rounded-xl border p-3 flex items-start gap-2" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)' }}>
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
          <p className="text-xs" style={{ color: '#fca5a5' }}>
            <span className="font-semibold">{overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''}:</span>{' '}
            {overdueTasks.map(t => t.title).join(', ')}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg p-1" style={{ background: 'var(--bg-elevated)' }}>
          {(['schedule', 'log'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors"
              style={{ background: tab === t ? 'var(--bg-surface)' : 'transparent', color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {t === 'schedule' ? 'Upcoming Schedule' : 'Work Log'}
            </button>
          ))}
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={() => setShowAddTask(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              <Calendar size={11} /> Add Task
            </button>
            <button onClick={() => setShowLogWork(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white" style={{ background: 'var(--accent)' }}>
              <Wrench size={11} /> Log Work
            </button>
          </div>
        )}
      </div>

      {tab === 'schedule' && (
        tasks.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: 'var(--text-muted)' }}>
            No maintenance tasks scheduled. Upload a manual and use AI Extract, or add tasks manually.
          </p>
        ) : (
          <div className="space-y-2">
            {tasks.sort((a, b) => (a.next_due_date ?? '9999') < (b.next_due_date ?? '9999') ? -1 : 1).map(t => {
              const days = daysUntil(t.next_due_date)
              const urgent = days !== null && days <= 0
              const soon = days !== null && days > 0 && days <= 14
              return (
                <div key={t.id} className="rounded-xl border p-4" style={{ background: 'var(--bg-surface)', borderColor: urgent ? 'rgba(239,68,68,0.3)' : soon ? 'rgba(245,158,11,0.3)' : 'var(--border)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t.title}</p>
                        {t.manual_id && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(108,114,245,0.1)', color: 'var(--accent)' }}>AI</span>}
                        {t.recurring && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>Recurring</span>}
                      </div>
                      {t.description && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t.description}</p>}
                      {t.interval_type && (
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                          Every {t.interval_value} {t.interval_type}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {t.next_due_date && (
                        <>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(t.next_due_date).toLocaleDateString('en-GB')}</p>
                          <p className="text-xs font-semibold" style={{ color: urgent ? '#ef4444' : soon ? '#f59e0b' : '#22c55e' }}>
                            {urgent ? `${Math.abs(days!)}d overdue` : days === 0 ? 'Due today' : `${days}d`}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {tab === 'log' && (
        logs.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: 'var(--text-muted)' }}>No work logged yet</p>
        ) : (
          <div className="space-y-3">
            {logs.map(l => {
              const totalCost = Number(l.labour_cost) + Number(l.parts_cost)
              return (
                <div key={l.id} className="rounded-xl border p-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{l.description}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {new Date(l.carried_out_date).toLocaleDateString('en-GB')}
                        {l.carried_out_by ? ` · ${l.carried_out_by}` : ''}
                      </p>
                      {(l.parts_used as any[]).length > 0 && (
                        <div className="mt-2 space-y-0.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Parts used</p>
                          {(l.parts_used as any[]).map((p, i) => (
                            <p key={i} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {p.name} × {p.qty} — £{Number(p.cost).toFixed(2)}
                            </p>
                          ))}
                        </div>
                      )}
                      {l.notes && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{l.notes}</p>}
                    </div>
                    <div className="text-right flex-shrink-0 space-y-1">
                      {totalCost > 0 && <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>£{totalCost.toFixed(2)}</p>}
                      {Number(l.downtime_hours) > 0 && (
                        <p className="text-xs" style={{ color: '#f59e0b' }}>{l.downtime_hours}h downtime</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Add Maintenance Task</h2>
              <button onClick={() => setShowAddTask(false)}><X size={16} style={{ color: 'var(--text-muted)' }} /></button>
            </div>
            <form onSubmit={saveTask} className="p-5 space-y-3">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Task Title *</label>
                <input required value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border" placeholder="e.g. Engine oil change"
                  style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Description</label>
                <textarea value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 rounded-lg text-sm border resize-none"
                  style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Interval</label>
                  <input type="number" value={taskForm.interval_value} onChange={e => setTaskForm(f => ({ ...f, interval_value: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Unit</label>
                  <select value={taskForm.interval_type} onChange={e => setTaskForm(f => ({ ...f, interval_type: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                    <option value="hours">Hours</option>
                    <option value="months">Months</option>
                    <option value="weeks">Weeks</option>
                    <option value="km">km</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Next Due</label>
                  <input type="date" value={taskForm.next_due_date} onChange={e => setTaskForm(f => ({ ...f, next_due_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                <input type="checkbox" checked={taskForm.recurring} onChange={e => setTaskForm(f => ({ ...f, recurring: e.target.checked }))} />
                Recurring task
              </label>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowAddTask(false)} className="flex-1 px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>
                  {saving ? 'Saving...' : 'Add Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Work Modal */}
      {showLogWork && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Log Maintenance Work</h2>
              <button onClick={() => setShowLogWork(false)}><X size={16} style={{ color: 'var(--text-muted)' }} /></button>
            </div>
            <form onSubmit={saveLog} className="p-5 space-y-3">
              {tasks.length > 0 && (
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Related Task (optional)</label>
                  <select value={logForm.task_id} onChange={e => setLogForm(f => ({ ...f, task_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                    <option value="">None / ad-hoc</option>
                    {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Description of Work *</label>
                <textarea required value={logForm.description} onChange={e => setLogForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 rounded-lg text-sm border resize-none"
                  style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Carried Out By</label>
                  <input value={logForm.carried_out_by} onChange={e => setLogForm(f => ({ ...f, carried_out_by: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" placeholder="Name or company"
                    style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Date</label>
                  <input type="date" value={logForm.carried_out_date} onChange={e => setLogForm(f => ({ ...f, carried_out_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Labour Cost (£)</label>
                  <input type="number" step="0.01" value={logForm.labour_cost} onChange={e => setLogForm(f => ({ ...f, labour_cost: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Downtime (hours)</label>
                  <input type="number" step="0.5" value={logForm.downtime_hours} onChange={e => setLogForm(f => ({ ...f, downtime_hours: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Next Due Date</label>
                  <input type="date" value={logForm.next_due_date} onChange={e => setLogForm(f => ({ ...f, next_due_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
              </div>

              {/* Parts */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Parts Used</label>
                  <button type="button" onClick={() => setLogForm(f => ({ ...f, parts: [...f.parts, { name: '', qty: '1', cost: '' }] }))}
                    className="text-xs" style={{ color: 'var(--accent)' }}>+ Add part</button>
                </div>
                {logForm.parts.map((p, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 mb-2 items-center">
                    <input value={p.name} onChange={e => setLogForm(f => { const parts = [...f.parts]; parts[i] = { ...parts[i], name: e.target.value }; return { ...f, parts } })}
                      className="col-span-5 px-2 py-1.5 rounded-lg text-xs border" placeholder="Part name"
                      style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                    <input type="number" value={p.qty} onChange={e => setLogForm(f => { const parts = [...f.parts]; parts[i] = { ...parts[i], qty: e.target.value }; return { ...f, parts } })}
                      className="col-span-2 px-2 py-1.5 rounded-lg text-xs border" placeholder="Qty"
                      style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                    <input type="number" step="0.01" value={p.cost} onChange={e => setLogForm(f => { const parts = [...f.parts]; parts[i] = { ...parts[i], cost: e.target.value }; return { ...f, parts } })}
                      className="col-span-4 px-2 py-1.5 rounded-lg text-xs border" placeholder="Cost £"
                      style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                    <button type="button" onClick={() => setLogForm(f => ({ ...f, parts: f.parts.filter((_, j) => j !== i) }))} className="col-span-1">
                      <X size={12} style={{ color: 'var(--text-muted)' }} />
                    </button>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Notes</label>
                <textarea value={logForm.notes} onChange={e => setLogForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 rounded-lg text-sm border resize-none"
                  style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowLogWork(false)} className="flex-1 px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>
                  {saving ? 'Saving...' : 'Log Work'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
