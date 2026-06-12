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

  // ── design_findings is the source of truth ─────────────────────────────────
  const { data: findings } = await supabase
    .from('design_findings')
    .select('id, run_id, lens, severity, title, description, clause_ref, drawing_refs, document_refs, status, decision_type, review_notes, reviewed_by, reviewed_at, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  // ── Audit log entries (may be empty for pre-migration findings) ────────────
  const { data: logEntries } = await supabase
    .from('design_decision_log')
    .select('id, finding_id, lens, finding_title, severity, action, decision_type, comment, actioned_by, actioned_at')
    .eq('project_id', projectId)
    .order('actioned_at', { ascending: true })

  // ── Runs for context ───────────────────────────────────────────────────────
  const { data: runs } = await supabase
    .from('design_review_runs')
    .select('id, run_at')
    .eq('project_id', projectId)

  // ── Resolve all user IDs (reviewers + log actors) ─────────────────────────
  const allUserIds = [
    ...(findings ?? []).map((f: any) => f.reviewed_by),
    ...(logEntries ?? []).map((e: any) => e.actioned_by),
  ].filter(Boolean)
  const uniqueIds = [...new Set(allUserIds)]

  let profiles: any[] = []
  if (uniqueIds.length) {
    const { data } = await supabase.from('profiles').select('id, full_name, email').in('id', uniqueIds)
    profiles = data ?? []
  }

  function nameOf(id: string | null | undefined): string {
    if (!id) return 'AI Review Engine'
    const p = profiles.find((x: any) => x.id === id)
    return p?.full_name ?? p?.email ?? 'Unknown'
  }

  const runMap = Object.fromEntries((runs ?? []).map((r: any) => [r.id, r]))

  // Group log entries by finding_id
  const logByFinding: Record<string, any[]> = {}
  for (const e of logEntries ?? []) {
    if (!logByFinding[e.finding_id]) logByFinding[e.finding_id] = []
    logByFinding[e.finding_id].push({ ...e, actor_name: nameOf(e.actioned_by) })
  }

  // Build enriched findings — each carries its full audit timeline
  const enrichedFindings = (findings ?? []).map((f: any) => {
    const run = runMap[f.run_id] ?? null
    const existingLog = logByFinding[f.id] ?? []

    // Synthesise a "Raised" entry for findings that predate the log table
    const hasRaisedEntry = existingLog.some((e: any) => e.action === 'Raised')
    const timeline = hasRaisedEntry ? existingLog : [
      {
        id: `synthetic-${f.id}`,
        finding_id: f.id,
        action: 'Raised',
        decision_type: null,
        comment: `Raised by AI review (${run ? new Date(run.run_at).toLocaleDateString('en-GB') : 'unknown date'})`,
        actioned_by: null,
        actor_name: 'AI Review Engine',
        actioned_at: f.created_at,
      },
      ...existingLog,
    ]

    // If finding has been reviewed but no corresponding log entry exists, append one
    const hasDecisionEntry = timeline.some((e: any) => e.action === 'Approved' || e.action === 'Rejected')
    if (!hasDecisionEntry && f.status !== 'Pending' && f.reviewed_at) {
      timeline.push({
        id: `synthetic-decision-${f.id}`,
        finding_id: f.id,
        action: f.status,
        decision_type: f.decision_type ?? null,
        comment: f.review_notes ?? null,
        actioned_by: f.reviewed_by,
        actor_name: nameOf(f.reviewed_by),
        actioned_at: f.reviewed_at,
      })
    }

    return {
      ...f,
      reviewer_name: nameOf(f.reviewed_by),
      timeline,
    }
  })

  return (
    <DecisionLog
      projectId={projectId}
      projectName={project.name}
      findings={enrichedFindings}
    />
  )
}
