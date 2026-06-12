'use client'

import { useState } from 'react'
import { UserPlus, ChevronDown, ChevronUp, FolderOpen, X, Plus } from 'lucide-react'

const ROLES = ['admin', 'project_manager', 'engineer', 'operative', 'client'] as const
type Role = typeof ROLES[number]

const ROLE_COLOUR: Record<Role, string> = {
  admin:           '#dc2626',
  project_manager: '#2563eb',
  engineer:        '#7c3aed',
  operative:       '#d97706',
  client:          '#16a34a',
}

interface UserRow { id: string; email: string; full_name: string | null; role: Role; created_at: string }
interface Project  { id: string; name: string; client: string }

interface Props {
  users: UserRow[]
  projects: Project[]
  assignmentMap: Record<string, string[]>
  currentUserId: string
}

const field: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  borderColor: 'var(--border)',
}

export default function UsersClient({ users: initial, projects, assignmentMap: initMap, currentUserId }: Props) {
  const [users, setUsers]         = useState<UserRow[]>(initial)
  const [assignMap, setAssignMap] = useState<Record<string, string[]>>(initMap)
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [inviting, setInviting]   = useState(false)
  const [form, setForm]           = useState({ email: '', full_name: '', role: 'engineer' as Role })
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  // per-user "adding project" state
  const [addingFor, setAddingFor]   = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState('')
  const [assignSaving, setAssignSaving] = useState(false)
  const [assignErr, setAssignErr] = useState('')

  async function invite() {
    if (!form.email.trim()) return
    setSaving(true); setErr(''); setSuccessMsg('')
    const res = await fetch('/api/admin/invite-user', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setErr(data.error); return }
    setSuccessMsg(`Invite sent to ${form.email}`)
    setUsers(prev => [{ id: data.userId, email: form.email, full_name: form.full_name || null, role: form.role, created_at: new Date().toISOString() }, ...prev])
    setAssignMap(prev => ({ ...prev, [data.userId]: [] }))
    setForm({ email: '', full_name: '', role: 'engineer' })
    setInviting(false)
  }

  async function changeRole(userId: string, role: Role) {
    setUpdatingId(userId)
    const res = await fetch('/api/admin/update-role', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, role }),
    })
    setUpdatingId(null)
    if (res.ok) setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
  }

  async function assignProject(userId: string, projectId: string, userRole: Role) {
    setAssignSaving(true); setAssignErr('')
    const res = await fetch('/api/admin/assign-project', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, projectId, targetRole: userRole }),
    })
    const data = await res.json()
    setAssignSaving(false)
    if (!res.ok) { setAssignErr(data.error); return }
    setAssignMap(prev => ({ ...prev, [userId]: [...(prev[userId] ?? []), projectId] }))
    setSelectedProject('')
    setAddingFor(null)
  }

  async function removeProject(userId: string, projectId: string, userRole: Role) {
    await fetch('/api/admin/assign-project', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, projectId, targetRole: userRole, remove: true }),
    })
    setAssignMap(prev => ({ ...prev, [userId]: (prev[userId] ?? []).filter(id => id !== projectId) }))
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Users</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{users.length} user{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => { setInviting(true); setErr(''); setSuccessMsg('') }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90"
          style={{ background: 'var(--accent)' }}>
          <UserPlus size={15} /> Invite user
        </button>
      </div>

      {/* Invite form */}
      {inviting && (
        <div className="rounded-xl border p-5 mb-6 space-y-3" style={{ background: 'var(--bg-surface)', borderColor: 'var(--accent)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Invite new user</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>They'll receive a magic-link email to set their password.</p>
          <div className="grid grid-cols-2 gap-3">
            <input className="rounded-lg border px-3 py-2 text-sm col-span-2" style={field}
              placeholder="Email address *" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email" />
            <input className="rounded-lg border px-3 py-2 text-sm" style={field}
              placeholder="Full name (optional)" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
            <select className="rounded-lg border px-3 py-2 text-sm" style={field}
              value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}>
              {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
            </select>
          </div>
          {err && <p className="text-xs" style={{ color: 'var(--critical)' }}>{err}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setInviting(false)} className="px-3 py-1.5 rounded-lg text-sm border"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>Cancel</button>
            <button onClick={invite} disabled={!form.email.trim() || saving}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ background: 'var(--accent)' }}>{saving ? 'Sending…' : 'Send invite'}</button>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl px-4 py-3 mb-4 text-sm"
          style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }}>
          {successMsg}
        </div>
      )}

      {/* User list */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <div className="grid grid-cols-12 px-5 py-2.5 text-xs font-medium border-b"
          style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
          <span className="col-span-4">Name</span>
          <span className="col-span-4">Email</span>
          <span className="col-span-3">Role</span>
          <span className="col-span-1" />
        </div>

        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {users.map(u => {
            const isExpanded   = expanded === u.id
            const assignedIds  = assignMap[u.id] ?? []
            const assignedProjs = projects.filter(p => assignedIds.includes(p.id))
            const unassigned   = projects.filter(p => !assignedIds.includes(p.id))
            const isAdmin      = u.role === 'admin'

            return (
              <div key={u.id} style={{ borderColor: 'var(--border)' }}>
                {/* User row */}
                <div className="grid grid-cols-12 px-5 py-3 items-center">
                  <span className="col-span-4 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {u.full_name ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    {u.id === currentUserId && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>you</span>
                    )}
                  </span>
                  <span className="col-span-4 text-sm truncate" style={{ color: 'var(--text-muted)' }}>{u.email}</span>
                  <span className="col-span-3">
                    <div className="relative inline-block">
                      <select value={u.role} disabled={u.id === currentUserId || updatingId === u.id}
                        onChange={e => changeRole(u.id, e.target.value as Role)}
                        className="appearance-none rounded-lg pl-2.5 pr-7 py-1 text-xs font-medium border cursor-pointer disabled:opacity-60"
                        style={{ background: `${ROLE_COLOUR[u.role]}18`, color: ROLE_COLOUR[u.role], borderColor: `${ROLE_COLOUR[u.role]}44` }}>
                        {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                      </select>
                      <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                        style={{ color: ROLE_COLOUR[u.role] }} />
                    </div>
                  </span>
                  <span className="col-span-1 flex justify-end">
                    <button onClick={() => setExpanded(isExpanded ? null : u.id)}
                      className="flex items-center gap-1 text-xs hover:opacity-70 transition-opacity"
                      style={{ color: 'var(--text-muted)' }}>
                      <FolderOpen size={13} />
                      {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>
                  </span>
                </div>

                {/* Expanded project assignments */}
                {isExpanded && (
                  <div className="px-5 pb-4 pt-1 border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                      {isAdmin ? 'Admins have access to all projects' : `Project access (${assignedProjs.length})`}
                    </p>

                    {!isAdmin && (
                      <>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {assignedProjs.length === 0 && (
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No projects assigned — user won't see anything.</p>
                          )}
                          {assignedProjs.map(p => (
                            <div key={p.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border"
                              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                              <span>{p.name}</span>
                              <span style={{ color: 'var(--text-muted)' }}>·</span>
                              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{p.client}</span>
                              <button onClick={() => removeProject(u.id, p.id, u.role)}
                                className="ml-1 hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
                                <X size={11} />
                              </button>
                            </div>
                          ))}
                        </div>

                        {addingFor === u.id ? (
                          <div className="flex gap-2 items-center">
                            <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
                              className="flex-1 rounded-lg border px-3 py-1.5 text-xs" style={field}>
                              <option value="">Select project…</option>
                              {unassigned.map(p => (
                                <option key={p.id} value={p.id}>{p.name} — {p.client}</option>
                              ))}
                            </select>
                            <button onClick={() => assignProject(u.id, selectedProject, u.role)}
                              disabled={!selectedProject || assignSaving}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                              style={{ background: 'var(--accent)' }}>
                              {assignSaving ? '…' : 'Add'}
                            </button>
                            <button onClick={() => { setAddingFor(null); setSelectedProject(''); setAssignErr('') }}
                              className="px-2 py-1.5 rounded-lg text-xs border"
                              style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          unassigned.length > 0 && (
                            <button onClick={() => { setAddingFor(u.id); setAssignErr('') }}
                              className="flex items-center gap-1.5 text-xs hover:opacity-70 transition-opacity"
                              style={{ color: 'var(--accent)' }}>
                              <Plus size={12} /> Assign project
                            </button>
                          )
                        )}
                        {assignErr && <p className="text-xs mt-1" style={{ color: 'var(--critical)' }}>{assignErr}</p>}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
