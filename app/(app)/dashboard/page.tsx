export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { getCompanyContext } from '@/lib/getCompanyContext'
import { FolderOpen, Plus, MessageSquare, ShieldAlert, TrendingDown } from 'lucide-react'
import ClientDashboard from '@/components/ClientDashboard'
import { getStageOrder, getStageColour } from '@/lib/stageDefaults'
import { createClient as createAdmin } from '@supabase/supabase-js'

export default async function DashboardPage() {
  const { supabase, user, profile, role, company, effectiveCompanyId } = await getCompanyContext()
  const industry = company?.industry ?? 'bess'
  const dashboardSubtitle = industry === 'civils'
    ? 'Construction management overview'
    : industry === 'electrical'
    ? 'HV electrical services overview'
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

    return <ClientDashboard profile={{ full_name: profile?.full_name ?? null, email: profile?.email ?? user.email ?? '' }} projects={enriched} industry={industry} />
  }

  // ── Internal dashboard ─────────────────────────────────────────────────────

  // Always scope to the subdomain company — even superadmin
  let projectQuery = supabase.from('projects').select('*').order('updated_at', { ascending: false })
  if (effectiveCompanyId) {
    projectQuery = projectQuery.eq('company_id', effectiveCompanyId)
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
    role !== 'operative' && projectIds.length > 0
      ? supabase.from('client_comments').select('id, project_id, subject_label, created_at, status').eq('status', 'Open').in('project_id', projectIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  // ── Compliance + cashflow (admin-scoped, no RLS bypass needed for counts) ──
  const adminDb = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const today = new Date().toISOString().split('T')[0]
  const in60Days = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [{ data: companyPeople }, { data: expiringPlant }, { data: overdueMs }, { data: dueSoonMs }] = await Promise.all([
    effectiveCompanyId
      ? adminDb.from('people').select('id').eq('company_id', effectiveCompanyId)
      : Promise.resolve({ data: [] }),
    effectiveCompanyId
      ? adminDb.from('plant_certificates').select('id, expiry_date').eq('company_id', effectiveCompanyId).not('expiry_date', 'is', null).lte('expiry_date', in60Days)
      : Promise.resolve({ data: [] }),
    effectiveCompanyId
      ? adminDb.from('payment_milestones').select('id, amount').eq('company_id', effectiveCompanyId).in('status', ['pending', 'invoiced']).not('due_date', 'is', null).lt('due_date', today)
      : Promise.resolve({ data: [] }),
    effectiveCompanyId
      ? adminDb.from('payment_milestones').select('id, amount').eq('company_id', effectiveCompanyId).in('status', ['pending', 'invoiced']).not('due_date', 'is', null).gte('due_date', today).lte('due_date', in30Days)
      : Promise.resolve({ data: [] }),
  ])

  const personIds = (companyPeople ?? []).map((p: any) => p.id)
  const { data: expiringCreds } = personIds.length > 0
    ? await adminDb.from('person_credentials').select('id, expiry_date').in('person_id', personIds).not('expiry_date', 'is', null).lte('expiry_date', in60Days)
    : { data: [] }

  const totalExpired = [...(expiringCreds ?? []), ...(expiringPlant ?? [])].filter((c: any) => c.expiry_date < today).length
  const totalExpiringSoon = [...(expiringCreds ?? []), ...(expiringPlant ?? [])].filter((c: any) => c.expiry_date >= today).length
  const amountOverdue = (overdueMs ?? []).reduce((s: number, m: any) => s + (m.amount ?? 0), 0)
  const amountDueSoon = (dueSoonMs ?? []).reduce((s: number, m: any) => s + (m.amount ?? 0), 0)

  // Count projects with each stage "In Progress"
  const stageOrder = getStageOrder(industry)
  const byStage = stageOrder.map(stage => ({
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

      {/* Compliance banner */}
      {(totalExpired > 0 || totalExpiringSoon > 0) && (
        <div className="rounded-xl border p-4" style={{ background: totalExpired > 0 ? 'rgba(248,113,113,0.08)' : 'rgba(251,191,36,0.08)', borderColor: totalExpired > 0 ? 'rgba(248,113,113,0.3)' : 'rgba(251,191,36,0.3)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert size={14} style={{ color: totalExpired > 0 ? '#f87171' : '#fbbf24' }} />
              <p className="text-sm font-semibold" style={{ color: totalExpired > 0 ? '#f87171' : '#fbbf24' }}>
                {totalExpired > 0
                  ? `${totalExpired} expired certificate${totalExpired !== 1 ? 's' : ''}`
                  : `${totalExpiringSoon} certificate${totalExpiringSoon !== 1 ? 's' : ''} expiring within 60 days`}
              </p>
            </div>
            <Link href="/team" className="text-xs hover:underline" style={{ color: totalExpired > 0 ? '#f87171' : '#fbbf24' }}>View →</Link>
          </div>
          {totalExpired > 0 && totalExpiringSoon > 0 && (
            <p className="text-xs mt-1 ml-5" style={{ color: totalExpired > 0 ? '#fca5a5' : '#fde68a' }}>+{totalExpiringSoon} expiring soon</p>
          )}
        </div>
      )}

      {/* Cashflow banner */}
      {(amountOverdue > 0 || amountDueSoon > 0) && (
        <div className="rounded-xl border p-4" style={{ background: amountOverdue > 0 ? 'rgba(248,113,113,0.08)' : 'rgba(96,165,250,0.08)', borderColor: amountOverdue > 0 ? 'rgba(248,113,113,0.3)' : 'rgba(96,165,250,0.3)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown size={14} style={{ color: amountOverdue > 0 ? '#f87171' : '#60a5fa' }} />
              <p className="text-sm font-semibold" style={{ color: amountOverdue > 0 ? '#f87171' : '#60a5fa' }}>
                {amountOverdue > 0
                  ? `GBP ${amountOverdue.toLocaleString('en-GB', { minimumFractionDigits: 2 })} overdue`
                  : `GBP ${amountDueSoon.toLocaleString('en-GB', { minimumFractionDigits: 2 })} due in 30 days`}
              </p>
            </div>
          </div>
          {amountOverdue > 0 && amountDueSoon > 0 && (
            <p className="text-xs mt-1 ml-5" style={{ color: '#fca5a5' }}>+GBP {amountDueSoon.toLocaleString('en-GB', { minimumFractionDigits: 2 })} due in 30 days</p>
          )}
        </div>
      )}

      {/* Stage summary */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Active stages across all projects</p>
        <div className="grid grid-cols-3 gap-3">
          {byStage.map(({ stage, inProgress, complete }) => (
            <div key={stage} className="rounded-xl p-4 border" style={{ background: 'var(--bg-surface)', borderColor: inProgress > 0 ? `${getStageColour(stage, industry)}55` : 'var(--border)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: inProgress > 0 ? getStageColour(stage, industry) : 'var(--text-muted)' }}>{stage}</p>
              <p className="text-3xl font-bold mb-1" style={{ color: inProgress > 0 ? getStageColour(stage, industry) : 'var(--text-muted)' }}>{inProgress}</p>
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
                            style={{ background: `${getStageColour(s, industry)}22`, color: getStageColour(s, industry), border: `1px solid ${getStageColour(s, industry)}55` }}>
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
