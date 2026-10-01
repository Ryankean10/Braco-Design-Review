'use client'

import { useState } from 'react'
import { UserPlus, X, HardHat } from 'lucide-react'

interface InternalUser {
  id: string
  full_name: string | null
  email: string
  role: string
}

interface Member {
  id: string
  user_id: string
  full_name: string | null
  email: string
  role: string
}

interface Props {
  projectId: string
  initialMembers: Member[]
  availableUsers: InternalUser[]
}

const ROLE_COLOUR: Record<string, string> = {
  admin:           '#dc2626',
  project_manager: '#2563eb',
  engineer:        '#7c3aed',
  operative:       '#d97706',
}

export default function TeamAccessPanel({ projectId, initialMembers, availableUsers }: Props) {
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [adding, setAdding] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const unassigned = availableUsers.filter(u => !members.find(m => m.user_id === u.id))

  async function assign() {
    if (!selectedId) return
    setSaving(true); setErr('')
    const user = availableUsers.find(u => u.id === selectedId)!
    const res = await fetch('/api/admin/assign-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: selectedId, projectId, targetRole: user.role }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setErr(data.error); return }
    setMembers(prev => [...prev, { id: crypto.randomUUID(), user_id: selectedId, full_name: user.full_name, email: user.email, role: user.role }])
    setSelectedId(''); setAdding(false)
  }

  async function remove(userId: string, role: string) {
    await fetch('/api/admin/assign-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, projectId, targetRole: role, remove: true }),
    })
    setMembers(prev => prev.filter(m => m.user_id !== userId))
  }

  return (
    <div className="rounded-xl border p-5" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <HardHat size={15} style={{ color: 'var(--accent)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Team Access</p>
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
            {members.length}
          </span>
        </div>
        {!adding && unassigned.length > 0 && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border hover:opacity-80"
            style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>
            <UserPlus size={12} /> Add member
          </button>
        )}
      </div>

      {members.length === 0 && !adding && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No team members assigned — internal users without a project assignment won't see this project.</p>
      )}

      <div className="space-y-2">
        {members.map(m => (
          <div key={m.user_id} className="flex items-center justify-between px-3 py-2 rounded-lg border"
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                style={{ background: `${ROLE_COLOUR[m.role] ?? '#888'}22`, color: ROLE_COLOUR[m.role] ?? '#888' }}>
                {m.role.replace('_', ' ')}
              </span>
              <div className="min-w-0">
                <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{m.full_name ?? m.email}</p>
                {m.full_name && <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{m.email}</p>}
              </div>
            </div>
            <button onClick={() => remove(m.user_id, m.role)} className="ml-2 shrink-0 hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {adding && (
        <div className="mt-3 flex gap-2">
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
            className="flex-1 rounded-lg border px-3 py-2 text-sm"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}>
            <option value="">Select team member…</option>
            {unassigned.map(u => (
              <option key={u.id} value={u.id}>
                {u.full_name ? `${u.full_name} (${u.role.replace('_', ' ')})` : `${u.email} (${u.role.replace('_', ' ')})`}
              </option>
            ))}
          </select>
          <button onClick={assign} disabled={!selectedId || saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--accent)' }}>
            {saving ? 'Adding…' : 'Add'}
          </button>
          <button onClick={() => { setAdding(false); setSelectedId(''); setErr('') }}
            className="px-3 py-2 rounded-lg text-sm border"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
            Cancel
          </button>
        </div>
      )}
      {err && <p className="text-xs mt-2" style={{ color: 'var(--critical)' }}>{err}</p>}
    </div>
  )
}
