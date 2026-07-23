import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCompanyContext } from '@/lib/getCompanyContext'
import { Plus, FolderOpen } from 'lucide-react'
import { STAGE_ORDER } from '@/lib/stageDefaults'
import type { StageName } from '@/lib/stageDefaults'

const STAGE_COLOUR: Record<StageName, string> = {
  'Feasibility':         '#4b5563',
  'Design':              '#2563eb',
  'Procure':             '#7c3aed',
  'Build & Install':     '#d97706',
  'Test & Commission':   '#dc2626',
  'Energise & Handover': '#16a34a',
}

export default async function ProjectsPage() {
  const { supabase, user, role, effectiveCompanyId } = await getCompanyContext()

  let projectIds: string[] | null = null
  if (!['superadmin', 'admin'].includes(role)) {
    const table = role === 'client' ? 'project_clients' : 'project_members'
    const { data: memberships } = await supabase.from(table).select('project_id').eq('user_id', user.id)
    projectIds = (memberships ?? []).map((m: any) => m.project_id)
  }

  // Always scope to subdomain company
  let projectQuery = supabase.from('projects').select('*').order('updated_at', { ascending: false })
  if (effectiveCompanyId) projectQuery = projectQuery.eq('company_id', effectiveCompanyId)
  if (projectIds !== null) {
    if (projectIds.length === 0) projectQuery = projectQuery.in('id', ['none'])
    else projectQuery = projectQuery.in('id', projectIds)
  }

  const [{ data: projects }, { data: stages }] = await Promise.all([
    projectQuery,
    supabase.from('project_stages').select('project_id, stage, status'),
  ])

  // Build active stage labels per project
  const activeMap: Record<string, string[]> = {}
  for (const s of stages ?? []) {
    if (s.status === 'In Progress' || s.status === 'On Hold') {
      if (!activeMap[s.project_id]) activeMap[s.project_id] = []
      // preserve STAGE_ORDER ordering
      activeMap[s.project_id].push(s.stage)
    }
  }
  // Sort each project's active stages by STAGE_ORDER index
  for (const pid of Object.keys(activeMap)) {
    activeMap[pid].sort((a, b) => STAGE_ORDER.indexOf(a as StageName) - STAGE_ORDER.indexOf(b as StageName))
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Projects</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {projects?.length ?? 0} project{projects?.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/projects/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity"
          style={{ background: 'var(--accent)' }}
        >
          <Plus size={15} />
          New project
        </Link>
      </div>

      <div className="rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        {!projects?.length ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <FolderOpen size={36} style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No projects yet</p>
            <Link href="/projects/new" className="text-sm px-4 py-2 rounded-lg text-white" style={{ background: 'var(--accent)' }}>
              Create your first project
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-12 px-6 py-2.5 text-xs font-medium border-b"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
              <span className="col-span-4">Project</span>
              <span className="col-span-2">Client</span>
              <span className="col-span-2">Location</span>
              <span className="col-span-1 text-right">MW</span>
              <span className="col-span-3 text-right">Active stages</span>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {(projects ?? []).map(p => {
                const active = activeMap[p.id] ?? []
                return (
                  <Link key={p.id} href={`/projects/${p.id}`}
                    className="grid grid-cols-12 px-6 py-3.5 items-center hover:opacity-80 transition-opacity">
                    <span className="col-span-4 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                    <span className="col-span-2 text-sm" style={{ color: 'var(--text-muted)' }}>{p.client}</span>
                    <span className="col-span-2 text-sm" style={{ color: 'var(--text-muted)' }}>{p.location}</span>
                    <span className="col-span-1 text-sm text-right" style={{ color: 'var(--text-muted)' }}>{p.capacity_mw ?? '—'}</span>
                    <span className="col-span-3 flex gap-1.5 justify-end flex-wrap">
                      {active.length > 0
                        ? active.map(s => {
                            const col = STAGE_COLOUR[s as StageName] ?? '#4b5563'
                            return (
                              <span key={s} className="text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                                style={{ background: `${col}22`, color: col, border: `1px solid ${col}55` }}>
                                {s}
                              </span>
                            )
                          })
                        : <span className="text-[10px] px-2 py-0.5 rounded-full"
                            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                            Not started
                          </span>
                      }
                    </span>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
