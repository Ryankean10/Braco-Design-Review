'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Project, Stage } from '@/lib/types'
import { getStageOrder } from '@/lib/stageDefaults'

const BESS_STAGES: Stage[] = [
  'Feasibility', 'Design', 'Procure', 'Build & Install', 'Test & Commission', 'Energise & Handover'
]

interface Props {
  project?: Project
  industry?: string
}

export default function ProjectForm({ project, industry = 'bess' }: Props) {
  const router = useRouter()
  const isEdit = !!project
  const isCivils = industry === 'civils'
  const stages = isCivils ? (getStageOrder('civils') as string[]) : BESS_STAGES

  const [name, setName] = useState(project?.name ?? '')
  const [client, setClient] = useState(project?.client ?? '')
  const [location, setLocation] = useState(project?.location ?? '')
  const [capacityMw, setCapacityMw] = useState(project?.capacity_mw?.toString() ?? '')
  const [stage, setStage] = useState<string>(project?.stage ?? stages[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()

    const payload: any = {
      name: name.trim(),
      client: client.trim(),
      location: location.trim(),
      stage,
      updated_at: new Date().toISOString(),
    }
    if (!isCivils && capacityMw) {
      payload.capacity_mw = parseFloat(capacityMw)
    }

    if (isEdit) {
      const { error } = await supabase.from('projects').update(payload).eq('id', project.id)
      if (error) { setError(error.message); setLoading(false); return }
      router.push(`/projects/${project.id}`)
    } else {
      const { data, error } = await supabase.from('projects').insert(payload).select().single()
      if (error) { setError(error.message); setLoading(false); return }
      router.push(`/projects/${data.id}`)
    }
    router.refresh()
  }

  async function handleDelete() {
    if (!project) return
    if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return
    const supabase = createClient()
    await supabase.from('projects').delete().eq('id', project.id)
    router.push('/projects')
    router.refresh()
  }

  const fieldStyle = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div
        className="rounded-xl border p-6 space-y-4"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      >
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Project name *
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={fieldStyle}
            placeholder={isCivils ? 'e.g. A9 Drainage Upgrade' : 'e.g. Braco 50 MW BESS'}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Client *
            </label>
            <input
              value={client}
              onChange={e => setClient(e.target.value)}
              required
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={fieldStyle}
              placeholder="Client name"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Location *
            </label>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              required
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={fieldStyle}
              placeholder="e.g. Perthshire, Scotland"
            />
          </div>
        </div>

        <div className={isCivils ? '' : 'grid grid-cols-2 gap-4'}>
          {!isCivils && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Capacity (MW)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={capacityMw}
                onChange={e => setCapacityMw(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={fieldStyle}
                placeholder="e.g. 50"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
              {isCivils ? 'Starting stage *' : 'Lifecycle stage *'}
            </label>
            <select
              value={stage}
              onChange={e => setStage(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={fieldStyle}
            >
              {stages.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm rounded-lg px-3 py-2" style={{ background: '#3f1212', color: '#f87171' }}>
          {error}
        </p>
      )}

      <div className="flex items-center justify-between">
        {isEdit ? (
          <button
            type="button"
            onClick={handleDelete}
            className="text-sm px-4 py-2 rounded-lg border transition-opacity hover:opacity-80"
            style={{ color: 'var(--critical)', borderColor: 'var(--border)' }}
          >
            Delete project
          </button>
        ) : <div />}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm px-4 py-2 rounded-lg border transition-opacity hover:opacity-80"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="text-sm px-4 py-2 rounded-lg font-medium text-white transition-opacity disabled:opacity-60 hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            {loading ? 'Saving…' : isEdit ? 'Save changes' : 'Create project'}
          </button>
        </div>
      </div>
    </form>
  )
}
