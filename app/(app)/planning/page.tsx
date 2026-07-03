import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TrendingUp, ChevronRight, CheckCircle2, Clock } from 'lucide-react'

export default async function PlanningPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? 'engineer'
  if (role === 'client') redirect('/dashboard')

  // All projects + their latest forecast (if any)
  const [{ data: projects }, { data: forecasts }] = await Promise.all([
    supabase.from('projects').select('id, name, stage, capacity_mw, location, client_name').order('created_at', { ascending: false }),
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
                    {project.client_name && <span>{project.client_name}</span>}
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
