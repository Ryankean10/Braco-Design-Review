import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import ReviewsPanel from '@/components/ReviewsPanel'

export default async function ReviewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: project }, { data: profile }] = await Promise.all([
    supabase.from('projects').select('id, name, client, location, er_storage_path').eq('id', projectId).single(),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
  ])

  if (!project) notFound()

  const role = profile?.role ?? 'engineer'
  if (role === 'client') redirect(`/projects/${projectId}`)

  const canEdit = ['admin', 'project_manager', 'engineer'].includes(role)

  const [
    { data: documents },
    { data: runs },
    { data: findings, error: findingsError },
  ] = await Promise.all([
    supabase
      .from('documents')
      .select('id, doc_no, title, rev, type, stage, mime_type, storage_path')
      .eq('project_id', projectId)
      .order('doc_no'),
    supabase
      .from('design_review_runs')
      .select('id, run_at, status, lenses, document_ids, run_by, error')
      .eq('project_id', projectId)
      .order('run_at', { ascending: false })
      .limit(10),
    supabase
      .from('design_findings')
      .select('id, run_id, lens, severity, title, description, clause_ref, drawing_refs, document_refs, procurement_item_id, status, reviewed_by, reviewed_at, review_notes, decision_type')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
  ])

  if (findingsError) console.error('[reviews/page] findings query error:', findingsError.message, findingsError.details)
  console.log('[reviews/page] findings count:', findings?.length ?? 0)

  // Resolve reviewer names for findings
  const reviewerIds = [...new Set((findings ?? []).map((f: any) => f.reviewed_by).filter(Boolean))]
  const runnerIds = [...new Set((runs ?? []).map((r: any) => r.run_by).filter(Boolean))]
  const allIds = [...new Set([...reviewerIds, ...runnerIds])]

  let profiles: any[] = []
  if (allIds.length) {
    const { data } = await supabase.from('profiles').select('id, full_name, email').in('id', allIds)
    profiles = data ?? []
  }

  function nameOf(id: string | null) {
    if (!id) return null
    const p = profiles.find((x: any) => x.id === id)
    return p?.full_name ?? p?.email ?? id
  }

  const enrichedFindings = (findings ?? []).map((f: any) => ({
    ...f,
    reviewer_name: nameOf(f.reviewed_by),
  }))

  const enrichedRuns = (runs ?? []).map((r: any) => ({
    ...r,
    runner_name: nameOf(r.run_by),
  }))

  return (
    <ReviewsPanel
      projectId={projectId}
      projectName={project.name}
      hasER={!!project.er_storage_path}
      canEdit={canEdit}
      documents={documents ?? []}
      initialRuns={enrichedRuns}
      initialFindings={enrichedFindings}
    />
  )
}
