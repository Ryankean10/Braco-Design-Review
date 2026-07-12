import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import WorkPlannerPanel from '@/components/planning/WorkPlannerPanel'

export default async function WorkPlannerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: project }, { data: profile }, { data: docs }, { data: existingForecast }] = await Promise.all([
    supabase.from('projects').select('id, name, capacity_mw, location, stage, client').eq('id', id).single(),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('documents').select('id, doc_no, title, type, rev, stage').eq('project_id', id).order('doc_no'),
    supabase.from('work_planner_forecasts').select('*').eq('project_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  if (!project) notFound()
  const role = profile?.role ?? 'engineer'
  if (role === 'client') redirect(`/projects/${id}`)
  if (role === 'project_manager' || role === 'operative') {
    const { data: membership } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership) redirect('/planning')
  }

  return (
    <WorkPlannerPanel
      project={project as { id: string; name: string; capacity_mw: number | null; location: string | null; stage: string | null; client: string | null }}
      documents={docs ?? []}
      initialForecast={existingForecast}
      canEdit={['admin', 'engineer', 'project_manager'].includes(role)}
    />
  )
}
