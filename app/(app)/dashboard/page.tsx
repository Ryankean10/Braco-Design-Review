export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { FolderOpen, Plus, MessageSquare } from 'lucide-react'
import ClientDashboard from '@/components/ClientDashboard'
import { STAGE_ORDER } from '@/lib/stageDefaults'
import type { StageName } from '@/lib/stageDefaults'

function stageColour(stage: StageName) {
  const map: Record<StageName, string> = {
    'Feasibility':         '#4b5563',
    'Design':              '#2563eb',
    'Procure':             '#7c3aed',
    'Build & Install':     '#d97706',
    'Test & Commission':   '#dc2626',
    'Energise & Handover': '#16a34a',
  }
  return map[stage] ?? '#4b5563'
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const headersList = await headers()
  const companySlug = headersList.get('x-company-slug') ?? 'braco'

  const [{ data: profile }, { data: company }] = await Promise.all([
    supabase.from('profiles').select('role, full_name, email, company_id').eq('id', user.id).single(),
    supabase.from('companies').select('tagline, industry').eq('slug', companySlug).single(),
  ])
  const role = profile?.role ?? 'engineer'
  const userCompanyId = (profile as any)?.company_id as string | null
  const industry = (company as any)?.industry ?? 'bess'
  const dashboardSubtitle = industry === 'civils'
    ? 'Construction management overview'
    : 'BESS project review overview'

  // ── Client dashboard ───────────────────────────────────────────────────────
  if (role === 'client') {
    // Only show projects this client user is assigned to
    const { data: assignments } = await supabase
      .from('project_clients')
      .select('project_id')
      .eq('user_id', user.id)

    const assignedIds = (assignments ?? []).map((a: any) => a.project_id)

    const { data: projects } = assignedIds.length > 0
      ? await supabase
          .from('projects')
          .select('id, name, client, location, stage, capacity_mw')
          .in('id', assignedIds)
          .order('updated_at', { ascending: false })
      : { data: [] }

    const projectIds = (projects ?? []).map((p: any) => p.id)

    const [{ data: docs }, { data: tests }, { data: comments }, { data: stageRows }] = await Promise.all([
      supabase.from('documents').select('id, project_id').eq('for_client_review', true).in('project_id', projectIds),
      supabase.from('test_register').select('id, project_id, status').in('project_id', projectIds),
      supabase.from('client_comments').select('id, project_id, status, created_by').in('project_id', projectIds),
      supabase.from('project_stages').select('project_id, stage, status').in('project_id', projectIds),
    ])

    // Build stage status map per project
    const stageStatusMap: Record<string, Record<string, string>> = {}
    for (const s of stageRows ?? []) {
      if (!stageStatusMap[s.project_id]) stageStatusMap[s.project_id] = {}
      stageStatusMap[s.project_id][s.stage] = s.status
    }

    const enriched = (projects ?? []).map((p: any) => ({
      ...p,
      stageStatuses:          stageStatusMap[p.id] ?? {},
      docCount:               (docs ?? []).filter((d: any) => d.project_id === p.id).length,
      testPassCount:          (tests ?? []).filter((t: any) => t.project_id === p.id && t.status === 'Pass').length,
      testTotalCount:         (tests ?? []).filter((t: any) => t.project_id === p.id).length,
      openComments:           (comments ?? []).filter((c: any) => c.project_id === p.id && c.status === 'Open' && c.created_by === user.id).length,
      awaitingResponseCount:  (comments ?? []).filter((c: any) => c.project_id === p.id && c.status === 'Responded' && c.created_by === user.id).length,
    }))

    return <ClientDashboard profile={{ full_name: profile?.full_name ?? null, email: profile?.email ?? user.email ?? '' }} projects={enriched} />
  }

  // ── Internal dashboard ─────────────────────────────────────────────────────

  // Non-admin roles only see their assigned projects
  let projectQuery = supabase.from('projects').select('*').order('updated_at', { ascending: false })
  // Explicit company filter — belt-and-suspenders on top of RLS
  if (role !== 'superadmin' && userCompanyId) {
    projectQuery = projectQuery.eq('company_id', userCompanyId)
  }
  if (!['superadmin', 'admin'].includes(role)) {
    const { data: memberships } = await supabase
      .from('project_members').select('project_id').eq('user_id', user.id)
    const ids = (memberships ?? []).map((m: any) => m.project_id)
    if (ids.length === 0) {
      // No assignments yet — show empty state
      return (
        <div className="p-8 max-w-6xl mx-auto">
          <h1 className="text-2xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>You haven't been assigned to any projects yet. Ask an admin to assign you.</p>
        </div>
      )
    }
    projectQuery = projectQuery.in('id', ids)
  }

  const { data: projects } = await projectQuery

  const projectIds = (projects ?? []).map((p: any) => p.id)

  const [{ data: allProjectStages }, { data: openComments }] = await Promise.all([
    projectIds.length > 0
      ? supabase.from('project_stages').select('project_id, stage, status, checklist').in('project_id', projectIds)
      : Promise.resolve({ data: [] }),
    role !== 'operative'
      ? supabase.from('client_comments').select('id, project_id, subject_label, created_at, status').eq('status', 'Open').order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  // Count projects with each stage "In Progress"
  const byStage = STAGE_ORDER.map(stage => ({
    stage,
    inProgress: (allProjectStages ?? []).filter(s => s.stage === stage && s.status === 'In Progress').length,
    complete:   (allProjectStages ?? []).filter(s => s.stage === stage && s.status === 'Complete').length,
  }))

  // Build active stage labels per project (for project list)
  const activeStagesMap: Record<string, string[]> = {}
  for (const s of allProjectStages ?? []) {
    if (s.status === 'In Progress' || s.status === 'On Hold') {
      if (!activeStagesMap[s.project_id]) activeStagesMap[s.project_id] = []
      activeStagesMap[s.project_id].push(s.stage)
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{dashboardSubtitle}</p>
        </div>
        {['admin', 'engineer'].includes(role) && (
          <Link href="/projects/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90"
            style={{ background: 'var(--accent)' }}>
            <Plus size={15} /> New project
          </Link>
        )}
      </div>

      {/* Client comment flag — admin/PM/engineer only */}
      {role !== 'operative' && (openComments ?? []).length > 0 && (
        <div className="rounded-xl border p-4" style={{ background: 'rgba(251,146,60,0.08)', borderColor: 'rgba(251,146,60,0.3)' }}>
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare size={14} style={{ color: '#fb923c' }} />
            <p className="text-sm font-semibold" style={{ color: '#fb923c' }}>
              {(openComments ?? []).length} open client comment{(openComments ?? []).length !== 1 ? 's' : ''} require a response
            </p>
          </div>
          <div className="space-y-1">
            {(openComments ?? []).slice(0, 5).map((c: any) => (
              <Link key={c.id} href={`/comments?project=${c.project_id}`}
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:opacity-80"
                style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.15)' }}>
                <span className="text-xs truncate" style={{ color: '#fdba74' }}>
                  {c.subject_label ?? 'General comment'}
                </span>
                <span className="text-[10px] flex-shrink-0 ml-2" style={{ color: '#fb923c' }}>
                  {new Date(c.created_at).toLocaleDateString('en-GB')}
                </span>
              </Link>
            ))}
            {(openComments ?? []).length > 5 && (
              <p className="text-xs px-3" style={{ color: '#fb923c' }}>+{(openComments ?? []).length - 5} more</p>
            )}
          </div>
        </div>
      )}

      {/* Stage summary */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Active stages across all projects</p>
        <div className="grid grid-cols-3 gap-3">
          {byStage.map(({ stage, inProgress, complete }) => (
            <div key={stage} className="rounded-xl p-4 border" style={{ background: 'var(--bg-surface)', borderColor: inProgress > 0 ? `${stageColour(stage)}55` : 'var(--border)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: inProgress > 0 ? stageColour(stage) : 'var(--text-muted)' }}>{stage}</p>
              <p className="text-3xl font-bold mb-1" style={{ color: inProgress > 0 ? stageColour(stage) : 'var(--text-muted)' }}>{inProgress}</p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                in progress{complete > 0 ? ` · ${complete} complete` : ''}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent projects */}
      <div className="rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Projects</h2>
          <Link href="/projects" className="text-xs hover:underline" style={{ color: 'var(--accent)' }}>View all</Link>
        </div>
        {!projects?.length ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <FolderOpen size={32} style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No projects yet</p>
            <Link href="/projects/new" className="text-sm px-4 py-2 rounded-lg text-white" style={{ background: 'var(--accent)' }}>
              Create your first project
            </Link>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {projects.slice(0, 8).map(project => {
              const active = activeStagesMap[project.id] ?? []
              return (
                <Link key={project.id} href={`/projects/${project.id}`}
                  className="flex items-center justify-between px-6 py-3.5 hover:opacity-80 transition-opacity gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{project.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {project.client} — {project.location}{project.capacity_mw ? ` · ${project.capacity_mw} MW` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
                    {active.length > 0
                      ? active.map(s => (
                          <span key={s} className="text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                            style={{ background: `${stageColour(s as StageName)}22`, color: stageColour(s as StageName), border: `1px solid ${stageColour(s as StageName)}55` }}>
                            {s}
                          </span>
                        ))
                      : <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>No active stages</span>
                    }
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
