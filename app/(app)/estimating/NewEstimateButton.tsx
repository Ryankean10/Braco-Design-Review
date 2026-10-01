'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

export default function NewEstimateButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [client, setClient] = useState('')
  const [saving, setSaving] = useState(false)

  async function create() {
    if (!title.trim()) return
    setSaving(true)
    const res = await fetch('/api/estimating', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), client_name: client.trim() || null }),
    })
    const { data } = await res.json()
    if (data?.id) router.push(`/estimating/${data.id}`)
    setSaving(false)
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--accent)' }}>
        <Plus size={14} /> New estimate
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-xl border p-6 w-full max-w-sm space-y-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>New Estimate</h2>
            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Job title *</label>
                <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
                  className="px-3 py-2 rounded-lg border text-sm"
                  style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  placeholder="e.g. Post & rail fencing — Hillside Farm"
                  onKeyDown={e => e.key === 'Enter' && create()}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Client name</label>
                <input value={client} onChange={e => setClient(e.target.value)}
                  className="px-3 py-2 rounded-lg border text-sm"
                  style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  placeholder="Optional"
                  onKeyDown={e => e.key === 'Enter' && create()}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={create} disabled={!title.trim() || saving} className="flex-1 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--accent)', opacity: !title.trim() ? 0.5 : 1 }}>
                {saving ? 'Creating…' : 'Create estimate'}
              </button>
              <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-muted)' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
