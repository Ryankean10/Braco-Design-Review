import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'
import type { Stage } from '@/lib/types'

const STAGE_ORDER: Stage[] = [
  'Feasibility', 'Design', 'Procure', 'Build & Install', 'Test & Commission', 'Energise & Handover'
]

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (!project) notFound()

  const currentIdx = STAGE_ORDER.indexOf(project.stage)

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/projects" className="transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {project.name}
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {project.client} · {project.location}{project.capacity_mw ? ` · ${project.capacity_mw} MW` : ''}
          </p>
        </div>
        <Link
          href={`/projects/${id}/edit`}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-opacity hover:opacity-80"
          style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
        >
          <Pencil size={13} />
          Edit
        </Link>
      </div>

      {/* Stage tracker */}
      <div
        className="rounded-xl border p-5 mb-6"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      >
        <p className="text-xs font-medium mb-4" style={{ color: 'var(--text-muted)' }}>LIFECYCLE STAGE</p>
        <div className="flex items-center gap-0">
          {STAGE_ORDER.map((stage, idx) => {
            const done = idx < currentIdx
            const active = idx === currentIdx
            return (
              <div key={stage} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center flex-1 min-w-0">
                  <div
                    className="w-3 h-3 rounded-full mb-1.5 shrink-0"
                    style={{
                      background: done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--border)',
                    }}
                  />
                  <span
                    className="text-[9px] text-center leading-tight px-0.5"
                    style={{ color: active ? 'var(--accent)' : done ? 'var(--success)' : 'var(--text-muted)' }}
                  >
                    {stage}
                  </span>
                </div>
                {idx < STAGE_ORDER.length - 1 && (
                  <div
                    className="h-px flex-1 mx-0.5 mb-4"
                    style={{ background: done ? 'var(--success)' : 'var(--border)' }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Placeholder panels for future milestones */}
      <div className="grid grid-cols-2 gap-4">
        {['Document Library', 'AI Reviews', 'Findings', 'Clash Detection'].map(label => (
          <div
            key={label}
            className="rounded-xl border p-5 flex items-center justify-center"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', minHeight: 120 }}
          >
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{label} — coming in M2/M3</p>
          </div>
        ))}
      </div>
    </div>
  )
}
