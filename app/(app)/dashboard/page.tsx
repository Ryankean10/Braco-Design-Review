import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { FolderOpen, Plus } from 'lucide-react'
import type { Stage } from '@/lib/types'

const STAGE_ORDER: Stage[] = [
  'Feasibility', 'Design', 'Procure', 'Build & Install', 'Test & Commission', 'Energise & Handover'
]

function stageColour(stage: Stage) {
  const map: Record<Stage, string> = {
    'Feasibility':          '#4b5563',
    'Design':               '#2563eb',
    'Procure':              '#7c3aed',
    'Build & Install':      '#d97706',
    'Test & Commission':    '#dc2626',
    'Energise & Handover':  '#16a34a',
  }
  return map[stage] ?? '#4b5563'
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false })

  const byStage = STAGE_ORDER.map(stage => ({
    stage,
    count: projects?.filter(p => p.stage === stage).length ?? 0,
  }))

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            BESS project review overview
          </p>
        </div>
        <Link
          href="/projects/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--accent)' }}
        >
          <Plus size={15} />
          New project
        </Link>
      </div>

      {/* Stage summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {byStage.map(({ stage, count }) => (
          <div
            key={stage}
            className="rounded-xl p-4 border"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
          >
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{stage}</p>
            <p className="text-3xl font-bold" style={{ color: stageColour(stage) }}>{count}</p>
          </div>
        ))}
      </div>

      {/* Recent projects */}
      <div className="rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Projects</h2>
          <Link href="/projects" className="text-xs hover:underline" style={{ color: 'var(--accent)' }}>
            View all
          </Link>
        </div>

        {!projects?.length ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <FolderOpen size={32} style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No projects yet</p>
            <Link
              href="/projects/new"
              className="text-sm px-4 py-2 rounded-lg text-white"
              style={{ background: 'var(--accent)' }}
            >
              Create your first project
            </Link>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {projects.slice(0, 5).map(project => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex items-center justify-between px-6 py-3.5 hover:opacity-80 transition-opacity"
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{project.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {project.client} — {project.location}
                    {project.capacity_mw ? ` · ${project.capacity_mw} MW` : ''}
                  </p>
                </div>
                <span
                  className="chip-stage text-xs px-2 py-0.5 rounded-full font-medium"
                >
                  {project.stage}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
