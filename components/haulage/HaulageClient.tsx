'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Send, ChevronLeft, ChevronRight, Truck, AlertTriangle, CheckCircle, Clock, Edit2, Trash2, X, Check, RefreshCw } from 'lucide-react'

interface Task { id: string; title: string; description: string | null; location: string | null; est_start: string | null; est_end: string | null; driver_id: string | null; vehicle_id: string | null; project_id: string | null; sort_order: number; people?: { name: string } | null; haulage_vehicles?: { name: string; reg: string } | null; projects?: { name: string } | null }
interface SheetLine { id: string; description: string; start_time: string | null; end_time: string | null; hours: number | null; project_id: string | null; task_id: string | null; is_flagged: boolean; flag_reason: string | null; is_adhoc: boolean }
interface Sheet { id: string; driver_id: string | null; status: string; brief_sent_at: string | null; reply_received_at: string | null; raw_reply: string | null; total_hours: number | null; notes: string | null; missing_tasks: { task_id: string; title: string }[] | null; people?: { name: string } | null; haulage_sheet_lines?: SheetLine[] }
interface Driver { id: string; name: string; email: string | null; phone: string | null }
interface Vehicle { id: string; name: string; reg: string | null; category: string }
interface Project { id: string; name: string }

interface Props {
  date: string; tasks: Task[]; sheets: Sheet[]; drivers: Driver[]; vehicles: Vehicle[]; projects: Project[]; companyId: string; userRole: string
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: React.ComponentType<any> }> = {
  pending:  { label: 'Awaiting reply', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', icon: Clock },
  received: { label: 'Reply received', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', icon: Clock },
  flagged:  { label: 'Needs attention', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: AlertTriangle },
  approved: { label: 'Approved', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', icon: CheckCircle },
}

const field: React.CSSProperties = { background: 'var(--bg-elevated)', color: 'var(--text-primary)', borderColor: 'var(--border)' }

export default function HaulageClient({ date, tasks: initialTasks, sheets: initialSheets, drivers, vehicles, projects, companyId, userRole }: Props) {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [sheets, setSheets] = useState<Sheet[]>(initialSheets)
  const [tab, setTab] = useState<'tasks' | 'sheets'>('tasks')
  const [showAddTask, setShowAddTask] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sendingBriefs, setSendingBriefs] = useState(false)
  const [msg, setMsg] = useState('')
  const [editingLine, setEditingLine] = useState<string | null>(null)
  const [reparsingId, setReparsingId] = useState<string | null>(null)
  const [reparseMsg, setReparseMsg] = useState<Record<string, string>>({})
  const [form, setForm] = useState({ title: '', description: '', location: '', driver_id: '', vehicle_id: '', project_id: '', est_start: '', est_end: '' })

  function shiftDate(days: number) {
    const d = new Date(date + 'T00:00:00')
    d.setDate(d.getDate() + days)
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
    router.push(`/haulage?date=${y}-${m}-${day}`)
  }

  const todayLocal = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}` })()
  const isToday = date === todayLocal

  async function addTask() {
    if (!form.title.trim()) return
    setSaving(true)
    const res = await fetch('/api/haulage/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, task_date: date, company_id: companyId, sort_order: tasks.length }),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) { setTasks(prev => [...prev, data]); setForm({ title: '', description: '', location: '', driver_id: '', vehicle_id: '', project_id: '', est_start: '', est_end: '' }); setShowAddTask(false) }
  }

  async function deleteTask(id: string) {
    await fetch(`/api/haulage/tasks/${id}`, { method: 'DELETE' })
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  async function sendBriefs() {
    setSendingBriefs(true); setMsg('')
    const res = await fetch('/api/haulage/send-briefs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, company_id: companyId }),
    })
    const data = await res.json()
    setSendingBriefs(false)
    setMsg(res.ok ? `Briefs sent to ${data.count} driver${data.count !== 1 ? 's' : ''}` : (data.error ?? 'Failed'))
    if (res.ok) { const r = await fetch(`/haulage?date=${date}`); router.refresh() }
  }

  async function approveLine(sheetId: string, lineId: string, updates: Partial<SheetLine>) {
    await fetch(`/api/haulage/sheets/${sheetId}/lines/${lineId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates),
    })
    setSheets(prev => prev.map(s => s.id === sheetId ? {
      ...s, haulage_sheet_lines: (s.haulage_sheet_lines ?? []).map(l => l.id === lineId ? { ...l, ...updates } : l)
    } : s))
    setEditingLine(null)
  }

  async function approveSheet(sheetId: string) {
    await fetch(`/api/haulage/sheets/${sheetId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'approved' }) })
    setSheets(prev => prev.map(s => s.id === sheetId ? { ...s, status: 'approved' } : s))
  }

  const driverMap = Object.fromEntries(drivers.map(d => [d.id, d]))
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]))
  const tasksByDriver = drivers.map(d => ({ driver: d, tasks: tasks.filter(t => t.driver_id === d.id) })).filter(g => g.tasks.length > 0)
  const unassigned = tasks.filter(t => !t.driver_id)

  const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const briefsSent = sheets.some(s => s.brief_sent_at)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Truck size={22} style={{ color: 'var(--accent)' }} />
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Haulage</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <button onClick={() => shiftDate(-1)} className="hover:opacity-70 transition-opacity"><ChevronLeft size={14} style={{ color: 'var(--text-muted)' }} /></button>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{displayDate}</span>
              <button onClick={() => shiftDate(1)} className="hover:opacity-70 transition-opacity"><ChevronRight size={14} style={{ color: 'var(--text-muted)' }} /></button>
              {!isToday && <button onClick={() => router.push('/haulage')} className="text-xs px-2 py-0.5 rounded" style={{ color: 'var(--accent)', background: 'rgba(var(--accent-rgb),0.1)' }}>Today</button>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'tasks' && (
            <>
              <button onClick={() => setShowAddTask(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border hover:opacity-80 transition-opacity" style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}>
                <Plus size={13} /> Add task
              </button>
              <button onClick={sendBriefs} disabled={sendingBriefs || tasks.length === 0} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-40 hover:opacity-90 transition-opacity" style={{ background: 'var(--accent)' }}>
                <Send size={13} /> {sendingBriefs ? 'Sending…' : briefsSent ? 'Resend briefs' : 'Send driver briefs'}
              </button>
            </>
          )}
        </div>
      </div>

      {msg && <div className="rounded-xl px-4 py-3 mb-4 text-sm" style={{ background: msg.includes('sent') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: msg.includes('sent') ? '#22c55e' : '#ef4444', border: `1px solid ${msg.includes('sent') ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}` }}>{msg}</div>}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 rounded-lg p-1 w-fit" style={{ background: 'var(--bg-elevated)' }}>
        {(['tasks', 'sheets'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className="px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize"
            style={tab === t ? { background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' } : { color: 'var(--text-muted)' }}>
            {t === 'sheets' ? `Daily sheets${sheets.filter(s => s.status === 'flagged').length > 0 ? ` · ${sheets.filter(s => s.status === 'flagged').length} flagged` : ''}` : 'Task plan'}
          </button>
        ))}
      </div>

      {/* TASK PLAN TAB */}
      {tab === 'tasks' && (
        <div className="space-y-4">
          {/* Add task form */}
          {showAddTask && (
            <div className="rounded-xl border p-5 space-y-3" style={{ background: 'var(--bg-surface)', borderColor: 'var(--accent)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>New task</p>
              <div className="grid grid-cols-2 gap-3">
                <input className="col-span-2 rounded-lg border px-3 py-2 text-sm" style={field} placeholder="Task title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                <input className="col-span-2 rounded-lg border px-3 py-2 text-sm" style={field} placeholder="Description / instructions" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                <input className="rounded-lg border px-3 py-2 text-sm" style={field} placeholder="Location" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
                <select className="rounded-lg border px-3 py-2 text-sm" style={field} value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}>
                  <option value="">No project (ad-hoc)</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select className="rounded-lg border px-3 py-2 text-sm" style={field} value={form.driver_id} onChange={e => setForm(f => ({ ...f, driver_id: e.target.value }))}>
                  <option value="">Assign driver…</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <select className="rounded-lg border px-3 py-2 text-sm" style={field} value={form.vehicle_id} onChange={e => setForm(f => ({ ...f, vehicle_id: e.target.value }))}>
                  <option value="">Assign vehicle…</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} {v.reg ? `(${v.reg})` : ''}</option>)}
                </select>
                <input type="time" className="rounded-lg border px-3 py-2 text-sm" style={field} placeholder="Est. start" value={form.est_start} onChange={e => setForm(f => ({ ...f, est_start: e.target.value }))} />
                <input type="time" className="rounded-lg border px-3 py-2 text-sm" style={field} placeholder="Est. end" value={form.est_end} onChange={e => setForm(f => ({ ...f, est_end: e.target.value }))} />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAddTask(false)} className="px-3 py-1.5 rounded-lg text-sm border" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>Cancel</button>
                <button onClick={addTask} disabled={!form.title.trim() || saving} className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>{saving ? 'Adding…' : 'Add task'}</button>
              </div>
            </div>
          )}

          {tasks.length === 0 && !showAddTask && (
            <div className="text-center py-16 rounded-xl border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              <Truck size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No tasks planned for this day.</p>
              <button onClick={() => setShowAddTask(true)} className="mt-3 text-sm" style={{ color: 'var(--accent)' }}>+ Add the first task</button>
            </div>
          )}

          {/* Tasks by driver */}
          {tasksByDriver.map(({ driver, tasks: dTasks }) => (
            <div key={driver.id} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
              <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: 'var(--accent)' }}>{driver.name[0]}</div>
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{driver.name}</span>
                <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>{driver.email}</span>
                <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>{dTasks.length} task{dTasks.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {dTasks.map((task, i) => (
                  <div key={task.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{task.title}</p>
                      {task.description && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{task.description}</p>}
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {task.location && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>📍 {task.location}</span>}
                        {task.projects && <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent)' }}>{(task.projects as any).name}</span>}
                        {task.haulage_vehicles && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>🚛 {(task.haulage_vehicles as any).name}</span>}
                        {(task.est_start || task.est_end) && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>⏰ {task.est_start ?? '?'} – {task.est_end ?? '?'}</span>}
                      </div>
                    </div>
                    <button onClick={() => deleteTask(task.id)} className="text-xs hover:opacity-70 shrink-0" style={{ color: 'var(--text-muted)' }}><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Unassigned tasks */}
          {unassigned.length > 0 && (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
                <span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Unassigned tasks</span>
              </div>
              {unassigned.map(task => (
                <div key={task.id} className="px-4 py-3 flex items-start gap-3 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex-1"><p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{task.title}</p></div>
                  <button onClick={() => deleteTask(task.id)} className="hover:opacity-70" style={{ color: 'var(--text-muted)' }}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DAILY SHEETS TAB */}
      {tab === 'sheets' && (
        <div className="space-y-4">
          {sheets.length === 0 && (
            <div className="text-center py-16 rounded-xl border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              <p className="text-sm">No driver replies received yet for this day.</p>
              <p className="text-xs mt-1">Sheets are created automatically when drivers reply to their brief.</p>
            </div>
          )}

          {sheets.map(sheet => {
            const cfg = STATUS_CFG[sheet.status] ?? STATUS_CFG.pending
            const Icon = cfg.icon
            const lines = sheet.haulage_sheet_lines ?? []
            const flaggedLines = lines.filter(l => l.is_flagged)
            const missingTasks = sheet.missing_tasks ?? []
            const canApprove = sheet.status !== 'approved' && flaggedLines.length === 0 && missingTasks.length === 0

            return (
              <div key={sheet.id} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
                {/* Sheet header */}
                <div className="px-4 py-3 border-b flex items-center gap-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: 'var(--accent)' }}>
                    {(sheet.people as any)?.name?.[0] ?? '?'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{(sheet.people as any)?.name ?? 'Unknown driver'}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {sheet.reply_received_at ? `Reply received ${new Date(sheet.reply_received_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'No reply yet'}
                      {sheet.total_hours ? ` · ${sheet.total_hours}h total` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>
                      <Icon size={11} /> {cfg.label}
                    </span>
                    {flaggedLines.length > 0 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>{flaggedLines.length} flagged</span>}
                  {missingTasks.length > 0 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>{missingTasks.length} task{missingTasks.length > 1 ? 's' : ''} not reported</span>}
                    {sheet.raw_reply && sheet.status !== 'approved' && (
                      <button onClick={async () => {
                        setReparsingId(sheet.id)
                        setReparseMsg(prev => ({ ...prev, [sheet.id]: '' }))
                        const res = await fetch(`/api/haulage/sheets/${sheet.id}/reparse`, { method: 'POST' })
                        if (res.ok) {
                          setReparseMsg(prev => ({ ...prev, [sheet.id]: '✓ Done' }))
                          setTimeout(() => { setReparsingId(null); router.refresh() }, 800)
                        } else {
                          const d = await res.json()
                          setReparseMsg(prev => ({ ...prev, [sheet.id]: `Error: ${d.error ?? 'failed'}` }))
                          setReparsingId(null)
                        }
                      }}
                      disabled={reparsingId === sheet.id}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border disabled:opacity-60"
                      style={{ borderColor: 'var(--border)', color: reparseMsg[sheet.id]?.startsWith('Error') ? '#ef4444' : 'var(--text-muted)' }}>
                        <RefreshCw size={10} className={reparsingId === sheet.id ? 'animate-spin' : ''} />
                        {reparsingId === sheet.id ? 'Re-parsing…' : reparseMsg[sheet.id] || 'Re-parse'}
                      </button>
                    )}
                    {canApprove && <button onClick={() => approveSheet(sheet.id)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium text-white" style={{ background: '#22c55e' }}><Check size={11} /> Approve</button>}
                  </div>
                </div>

                {/* Raw reply */}
                {sheet.raw_reply && (
                  <details className="px-4 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                    <summary className="text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}>View raw reply</summary>
                    <p className="text-xs mt-2 whitespace-pre-wrap" style={{ color: 'var(--text-muted)' }}>{sheet.raw_reply}</p>
                  </details>
                )}

                {/* Sheet lines */}
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {lines.map(line => (
                    <SheetLineRow
                      key={line.id}
                      line={line}
                      projects={projects}
                      editing={editingLine === line.id}
                      onEdit={() => setEditingLine(line.id)}
                      onCancel={() => setEditingLine(null)}
                      onSave={(updates) => approveLine(sheet.id, line.id, updates)}
                    />
                  ))}
                </div>

                {lines.length === 0 && sheet.raw_reply && (
                  <p className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>No lines parsed — raw reply captured above.</p>
                )}

                {/* Missing tasks — planned tasks not mentioned in the reply */}
                {missingTasks.length > 0 && (
                  <div className="border-t" style={{ borderColor: 'var(--border)', background: 'rgba(239,68,68,0.04)' }}>
                    <p className="px-4 pt-3 pb-2 text-xs font-semibold" style={{ color: '#ef4444' }}>Tasks not reported by driver</p>
                    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                      {missingTasks.map((t, i) => (
                        <MissingTaskRow
                          key={i}
                          task={t}
                          sheetId={sheet.id}
                          driverId={sheet.driver_id ?? ''}
                          date={date}
                          companyId={companyId}
                          projects={projects}
                          onResolved={() => {
                            setSheets(prev => prev.map(s => s.id === sheet.id ? {
                              ...s,
                              missing_tasks: (s.missing_tasks ?? []).filter((_, idx) => idx !== i)
                            } : s))
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MissingTaskRow({ task, sheetId, driverId, date, companyId, projects, onResolved }: {
  task: { task_id: string; title: string }
  sheetId: string; driverId: string; date: string; companyId: string; projects: Project[]
  onResolved: () => void
}) {
  const [startTime, setStartTime] = useState('07:00')
  const [endTime, setEndTime] = useState('')
  const [projectId, setProjectId] = useState('')
  const [saving, setSaving] = useState(false)
  const [nextDayLoading, setNextDayLoading] = useState(false)
  const [msg, setMsg] = useState('')

  async function saveManualTime() {
    if (!startTime || !endTime) { setMsg('Enter both start and end time'); return }
    setSaving(true); setMsg('')
    const res = await fetch(`/api/haulage/sheets/${sheetId}/lines`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: task.title, start_time: startTime, end_time: endTime, project_id: projectId || null, task_id: task.task_id, is_adhoc: false }),
    })
    if (res.ok) {
      await fetch(`/api/haulage/sheets/${sheetId}/resolve-missing`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: task.task_id }),
      })
      onResolved()
    } else {
      const d = await res.json()
      setMsg(d.error ?? 'Failed to save')
    }
    setSaving(false)
  }

  async function addToNextDay() {
    setNextDayLoading(true); setMsg('')
    const res = await fetch('/api/haulage/tasks/copy-to-next-day', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: task.task_id, sheet_date: date, sheet_id: sheetId }),
    })
    const d = await res.json()
    setMsg(res.ok ? `Added to ${d.next_date}` : (d.error ?? 'Failed'))
    setNextDayLoading(false)
  }

  const inp = { background: 'var(--bg-elevated)', color: 'var(--text-primary)', borderColor: 'var(--border)' }

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle size={11} style={{ color: '#ef4444', flexShrink: 0 }} />
        <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{task.title}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-4">
        <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="rounded-lg border px-2 py-1 text-xs" style={inp} />
        <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="rounded-lg border px-2 py-1 text-xs" style={inp} />
        <select value={projectId} onChange={e => setProjectId(e.target.value)} className="rounded-lg border px-2 py-1 text-xs" style={inp}>
          <option value="">No project</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={saveManualTime} disabled={saving} className="px-2.5 py-1 rounded-lg text-xs font-medium text-white disabled:opacity-60" style={{ background: 'var(--accent)' }}>
          {saving ? 'Saving…' : 'Save times'}
        </button>
        <button onClick={addToNextDay} disabled={nextDayLoading} className="px-2.5 py-1 rounded-lg text-xs border disabled:opacity-60" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          {nextDayLoading ? 'Adding…' : '+ Next day'}
        </button>
      </div>
      {msg && <p className="text-xs pl-4" style={{ color: msg.startsWith('Added') ? '#22c55e' : '#ef4444' }}>{msg}</p>}
    </div>
  )
}

function SheetLineRow({ line, projects, editing, onEdit, onCancel, onSave }: {
  line: SheetLine; projects: Project[]; editing: boolean; onEdit: () => void; onCancel: () => void; onSave: (u: Partial<SheetLine>) => void
}) {
  const [projectId, setProjectId] = useState(line.project_id ?? '')
  const [startTime, setStartTime] = useState(line.start_time ?? '')
  const [endTime, setEndTime] = useState(line.end_time ?? '')
  const projectName = projects.find(p => p.id === line.project_id)?.name

  return (
    <div className="px-4 py-3" style={line.is_flagged ? { background: 'rgba(245,158,11,0.05)' } : {}}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{line.description}</p>
            {line.is_adhoc && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>Ad-hoc</span>}
            {line.is_flagged && <span className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}><AlertTriangle size={9} /> Flagged</span>}
          </div>
          {line.flag_reason && <p className="text-xs mt-0.5" style={{ color: '#f59e0b' }}>{line.flag_reason}</p>}
          {!editing && (
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {projectName && <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent)' }}>{projectName}</span>}
              {(line.start_time || line.end_time) && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>⏰ {line.start_time ?? '?'} – {line.end_time ?? '?'}</span>}
              {line.hours != null && <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{line.hours}h</span>}
            </div>
          )}
          {editing && (
            <div className="mt-2 flex flex-wrap gap-2">
              <select value={projectId} onChange={e => setProjectId(e.target.value)} className="rounded-lg border px-2 py-1 text-xs" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}>
                <option value="">No project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="rounded-lg border px-2 py-1 text-xs" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', borderColor: 'var(--border)' }} />
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="rounded-lg border px-2 py-1 text-xs" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', borderColor: 'var(--border)' }} />
              <button onClick={() => onSave({ project_id: projectId || null, start_time: startTime || null, end_time: endTime || null, is_flagged: false })} className="px-2.5 py-1 rounded-lg text-xs font-medium text-white" style={{ background: 'var(--accent)' }}>Save</button>
              <button onClick={onCancel} className="px-2 py-1 rounded-lg text-xs border" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>Cancel</button>
            </div>
          )}
        </div>
        {!editing && <button onClick={onEdit} className="hover:opacity-70 shrink-0" style={{ color: 'var(--text-muted)' }}><Edit2 size={13} /></button>}
      </div>
    </div>
  )
}
