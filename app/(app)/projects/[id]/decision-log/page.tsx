import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import DecisionLog from '@/components/DecisionLog'

export default async function DecisionLogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: project }, { data: profile }] = await Promise.all([
    supabase.from('projects').select('id, name, client, location').eq('id', projectId).single(),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
  ])

  if (!project) notFound()

  const role = profile?.role ?? 'engineer'
  if (role === 'client') redirect(`/projects/${projectId}`)

  // Load full decision log with finding detail
  const { data: logEntries } = await supabase
    .from('design_decision_log')
    .select('id, finding_id, run_id, lens, finding_title, severity, action, decision_type, comment, actioned_by, actioned_at')
    .eq('project_id', projectId)
    .order('actioned_at', { ascending: false })

  // Load findings for extra context (description, clause_ref, drawing_refs, status)
  const { data: findings } = await supabase
    .from('design_findings')
    .select('id, description, clause_ref, drawing_refs, document_refs, status, decision_type, review_notes, reviewed_at')
    .eq('project_id', projectId)

  // Load runs for run date context
  const { data: runs } = await supabase
    .from('design_review_runs')
    .select('id, run_at, document_ids')
    .eq('project_id', projectId)

  // Resolve actor names
  const actorIds = [...new Set((logEntries ?? []).map((e: any) => e.actioned_by).filter(Boolean))]
  let profiles: any[] = []
  if (actorIds.length) {
    const { data } = await supabase.from('profiles').select('id, full_name, email').in('id', actorIds)
    profiles = data ?? []
  }

  function nameOf(id: string | null) {
    if (!id) return 'System'
    const p = profiles.find((x: any) => x.id === id)
    return p?.full_name ?? p?.email ?? id
  }

  const findingMap = Object.fromEntries((findings ?? []).map((f: any) => [f.id, f]))
  const runMap = Object.fromEntries((runs ?? []).map((r: any) => [r.id, r]))

  const enriched = (logEntries ?? []).map((e: any) => ({
    ...e,
    actor_name: nameOf(e.actioned_by),
    finding: findingMap[e.finding_id] ?? null,
    run: runMap[e.run_id] ?? null,
  }))

  return (
    <DecisionLog
      projectId={projectId}
      projectName={project.name}
      entries={enriched}
    />
  )
}
