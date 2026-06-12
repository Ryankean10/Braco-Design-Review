'use client'

import { useState } from 'react'
import { UserPlus, ChevronDown } from 'lucide-react'

const ROLES = ['admin', 'project_manager', 'engineer', 'operative', 'client'] as const
type Role = typeof ROLES[number]

const ROLE_COLOUR: Record<Role, string> = {
  admin:           '#dc2626',
  project_manager: '#2563eb',
  engineer:        '#7c3aed',
  operative:       '#d97706',
  client:          '#16a34a',
}

interface UserRow {
  id: string
  email: string
  full_name: string | null
  role: Role
  created_at: string
}

interface Props {
  users: UserRow[]
  currentUserId: string
}

export default function UsersClient({ users: initial, currentUserId }: Props) {
  const [users, setUsers] = useState<UserRow[]>(initial)
  const [inviting, setInviting] = useState(false)
  const [form, setForm] = useState({ email: '', full_name: '', role: 'engineer' as Role })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  async function invite() {
    if (!form.email.trim()) return
    setSaving(true)
    setErr('')
    setSuccessMsg('')
    const res = await fetch('/api/admin/invite-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setErr(data.error); return }
    setSuccessMsg(`Invite sent to ${form.email}`)
    setUsers(prev => [{
      id: data.userId,
      email: form.email,
      full_name: form.full_name || null,
      role: form.role,
      created_at: new Date().toISOString(),
    }, ...prev])
    setForm({ email: '', full_name: '', role: 'engineer' })
    setInviting(false)
  }

  async function changeRole(userId: string, role: Role) {
    setUpdatingId(userId)
    const res = await fetch('/api/admin/update-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role }),
    })
    setUpdatingId(null)
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
    }
  }

  const field = {
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    borderColor: 'var(--border)',
  } as React.CSSProperties

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
        <div className="rounded-xl border p-5 mb-6 space-y-3"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--accent)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Invite new user</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>They'll receive an email with a magic link to set their password.</p>
          <div className="grid grid-cols-2 gap-3">
            <input
              className="rounded-lg border px-3 py-2 text-sm col-span-2"
              style={field}
              placeholder="Email address *"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              type="email"
            />
            <input
              className="rounded-lg border px-3 py-2 text-sm"
              style={field}
              placeholder="Full name (optional)"
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
            />
            <select
              className="rounded-lg border px-3 py-2 text-sm"
              style={field}
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}>
              {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
            </select>
          </div>
          {err && <p className="text-xs" style={{ color: 'var(--critical)' }}>{err}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setInviting(false)}
              className="px-3 py-1.5 rounded-lg text-sm border"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
              Cancel
            </button>
            <button onClick={invite} disabled={!form.email.trim() || saving}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ background: 'var(--accent)' }}>
              {saving ? 'Sending…' : 'Send invite'}
            </button>
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
          {users.map(u => (
            <div key={u.id} className="grid grid-cols-12 px-5 py-3 items-center">
              <span className="col-span-4 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {u.full_name ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                {u.id === currentUserId && (
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>you</span>
                )}
              </span>
              <span className="col-span-4 text-sm" style={{ color: 'var(--text-muted)' }}>{u.email}</span>
              <span className="col-span-3">
                <div className="relative inline-block">
                  <select
                    value={u.role}
                    disabled={u.id === currentUserId || updatingId === u.id}
                    onChange={e => changeRole(u.id, e.target.value as Role)}
                    className="appearance-none rounded-lg pl-2.5 pr-7 py-1 text-xs font-medium border cursor-pointer disabled:opacity-60"
                    style={{
                      background: `${ROLE_COLOUR[u.role]}18`,
                      color: ROLE_COLOUR[u.role],
                      borderColor: `${ROLE_COLOUR[u.role]}44`,
                    }}>
                    {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                  </select>
                  <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: ROLE_COLOUR[u.role] }} />
                </div>
              </span>
              <span className="col-span-1 text-xs text-right" style={{ color: 'var(--text-muted)' }}>
                {updatingId === u.id ? '…' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
