import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompanyId } from '@/lib/activeCompany'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TrendingUp, ChevronRight, CheckCircle2, Clock } from 'lucide-react'
import { headers } from 'next/headers'
import PersonnelPlanner from '@/components/planning/PersonnelPlanner'

export const dynamic = 'force-dynamic'

export default async function PlanningPage() {
  const slug = (await headers()).get('x-company-slug') ?? ''

  if (slug === 'boreaspower') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: profile } = await supabase.from('profiles').select('role, company_id').eq('id', user.id).single()
    const role = (profile as any)?.role ?? 'engineer'
    if (!['superadmin', 'admin', 'project_manager', 'engineer', 'operative'].includes(role)) redirect('/dashboard')

    const companyId = (profile as any)?.company_id ?? ''
    const canEdit = ['admin', 'superadmin', 'project_manager'].includes(role)

    // Current month date range for initial load
    const now = new Date()
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${lastDay}`

    const [{ data: people }, { data: assignments }] = await Promise.all([
      supabase.from('people').select('id, name, role, discipline, is_active').eq('company_id', companyId).eq('is_active', true).order('name'),
      (supabase as any).from('planner_assignments').select('*').eq('company_id', companyId).gte('date', from).lte('date', to).order('date'),
    ])

    return (
      <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Personnel Planner</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
            {canEdit ? 'Click any cell to assign a person to a job, meeting, or activity.' : 'View-only — contact an admin to make changes.'}
          </p>
        </div>
        {(people ?? []).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
            <TrendingUp size={40} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
            <p style={{ fontSize: 14 }}>No active people found. Add team members in the Team section first.</p>
          </div>
        ) : (
          <PersonnelPlanner
            people={(people ?? []) as any[]}
            initialAssignments={(assignments ?? []) as any[]}
            companyId={companyId}
            canEdit={canEdit}
          />
        )}
      </div>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role, company_id').eq('id', user.id).single()
  const role = profile?.role ?? 'engineer'
  const companyId: string = (await resolveActiveCompanyId(supabase, role, (profile as any)?.company_id)) ?? ''
  if (!['superadmin', 'admin', 'engineer', 'project_manager', 'operative'].includes(role)) redirect('/dashboard')

  let projectsQuery = supabase
    .from('projects')
    .select('id, name, stage, capacity_mw, location, client')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  // Project managers / operatives further restricted to their allocated projects
  if (role === 'project_manager' || role === 'operative') {
    const { data: memberships } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', user.id)
    const memberIds = (memberships ?? []).map((m: any) => m.project_id)
    projectsQuery = projectsQuery.in('id', memberIds.length > 0 ? memberIds : [''])
  }

  // All projects + their latest forecast (if any)
  const [{ data: projects }, { data: forecasts }] = await Promise.all([
    projectsQuery,
    supabase.from('work_planner_forecasts').select('project_id, created_at, forecast, status').order('created_at', { ascending: false }),
  ])

  // Latest forecast per project
  const latestForecast = new Map<string, { created_at: string; confidence: string; status: string }>()
  for (const f of forecasts ?? []) {
    if (!latestForecast.has(f.project_id)) {
      const confidence = (f.forecast as Record<string, unknown>)?.confidence as string ?? 'Low'
      latestForecast.set(f.project_id, { created_at: f.created_at, confidence, status: f.status })
    }
  }

  const CONF_COLOR: Record<string, string> = { High: '#10b981', Medium: '#f59e0b', Low: '#ef4444' }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <TrendingUp size={18} style={{ color: '#fbbf24' }} /> Work Planner
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            AI-assisted construction forecast — manpower, cost & long lead procurement, benchmarked against Dyce, Braco & Kilwinning.
          </p>
        </div>

        {/* Project list */}
        <div className="space-y-2">
          {(projects ?? []).map(project => {
            const fc = latestForecast.get(project.id)
            return (
              <Link key={project.id} href={`/projects/${project.id}/work-planner`}
                className="flex items-center gap-4 rounded-xl border px-5 py-4 hover:opacity-80 transition-opacity"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{project.name}</span>
                    {project.capacity_mw && (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                        {project.capacity_mw}MW
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {project.location && <span>{project.location}</span>}
                    {project.stage && (
                      <span className="px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-elevated)' }}>
                        {project.stage}
                      </span>
                    )}
                    {project.client && <span>{project.client}</span>}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {fc ? (
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="flex items-center gap-1 justify-end">
                          <CheckCircle2 size={10} style={{ color: '#10b981' }}/>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Forecast generated</span>
                        </div>
                        <div className="flex items-center gap-1.5 justify-end mt-0.5">
                          <span className="text-xs font-semibold" style={{ color: CONF_COLOR[fc.confidence] ?? '#6b7280' }}>
                            {fc.confidence} confidence
                          </span>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            · {new Date(fc.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <Clock size={11}/>No forecast yet
                    </div>
                  )}
                </div>

                <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} className="shrink-0"/>
              </Link>
            )
          })}

          {(projects ?? []).length === 0 && (
            <div className="rounded-xl border p-10 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
              <TrendingUp size={32} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text-muted)' }}/>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No projects yet. Create a project to start forecasting.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
