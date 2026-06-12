'use client'

import { useState } from 'react'
import { UserPlus, X, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface ClientUser {
  id: string
  full_name: string | null
  email: string
}

interface Assignment {
  id: string
  user_id: string
  full_name: string | null
  email: string
}

interface Props {
  projectId: string
  initialAssigned: Assignment[]
  availableClients: ClientUser[]
}

export default function ClientAccessPanel({ projectId, initialAssigned, availableClients }: Props) {
  const [assigned, setAssigned] = useState<Assignment[]>(initialAssigned)
  const [adding, setAdding] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const supabase = createClient()

  const unassigned = availableClients.filter(c => !assigned.find(a => a.user_id === c.id))

  async function assign() {
    if (!selectedId) return
    setSaving(true)
    setErr('')
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('project_clients')
      .insert({ project_id: projectId, user_id: selectedId, added_by: user?.id })
      .select('id, user_id')
      .single()
    setSaving(false)
    if (error) { setErr(error.message); return }
    const client = availableClients.find(c => c.id === selectedId)!
    setAssigned(prev => [...prev, { id: data.id, user_id: selectedId, full_name: client.full_name, email: client.email }])
    setSelectedId('')
    setAdding(false)
  }

  async function remove(assignmentId: string) {
    await supabase.from('project_clients').delete().eq('id', assignmentId)
    setAssigned(prev => prev.filter(a => a.id !== assignmentId))
  }

  return (
    <div className="rounded-xl border p-5" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users size={15} style={{ color: 'var(--accent)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Client Access</p>
        </div>
        {!adding && unassigned.length > 0 && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border hover:opacity-80"
            style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>
            <UserPlus size={12} /> Add client
          </button>
        )}
      </div>

      {assigned.length === 0 && !adding && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No client users assigned — they won't be able to see this project.</p>
      )}

      <div className="space-y-2">
        {assigned.map(a => (
          <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-lg border"
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
            <div>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{a.full_name ?? a.email}</p>
              {a.full_name && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.email}</p>}
            </div>
            <button onClick={() => remove(a.id)} className="hover:opacity-70 transition-opacity" style={{ color: 'var(--text-muted)' }}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {adding && (
        <div className="mt-3 flex gap-2">
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="flex-1 rounded-lg border px-3 py-2 text-sm"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}>
            <option value="">Select client user…</option>
            {unassigned.map(c => (
              <option key={c.id} value={c.id}>{c.full_name ? `${c.full_name} (${c.email})` : c.email}</option>
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
