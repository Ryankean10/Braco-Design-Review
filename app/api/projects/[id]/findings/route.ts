import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const APPROVE_DECISIONS = [
  'Design Change Required',
  'Accepted as Risk',
  'Deferred to Later Stage',
  'Further Investigation Required',
] as const

const REJECT_DECISIONS = [
  'Not Applicable',
  'AI Interpretation Error',
  'Duplicate Finding',
  'Out of Scope',
] as const

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'engineer'].includes(profile?.role ?? ''))
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const body = await req.json() as {
    id: string
    status: 'Approved' | 'Rejected'
    decision_type: string
    comment: string
  }
  const { id: findingId, status, decision_type, comment } = body

  if (!findingId || !['Approved', 'Rejected'].includes(status))
    return NextResponse.json({ error: 'id and status required' }, { status: 400 })

  if (!comment?.trim())
    return NextResponse.json({ error: 'A comment is required when reviewing a finding' }, { status: 400 })

  if (!decision_type)
    return NextResponse.json({ error: 'A decision type is required' }, { status: 400 })

  const validDecisions = status === 'Approved'
    ? APPROVE_DECISIONS as readonly string[]
    : REJECT_DECISIONS as readonly string[]

  if (!validDecisions.includes(decision_type))
    return NextResponse.json({ error: `Invalid decision type for ${status}` }, { status: 400 })

  const now = new Date().toISOString()

  // Load the finding for the audit log
  const { data: finding } = await supabase
    .from('design_findings')
    .select('id, run_id, project_id, lens, severity, title')
    .eq('id', findingId)
    .single()

  if (!finding) return NextResponse.json({ error: 'Finding not found' }, { status: 404 })

  // Update the finding
  const { error: updateErr } = await supabase
    .from('design_findings')
    .update({
      status,
      decision_type,
      review_notes: comment.trim(),
      reviewed_by: user.id,
      reviewed_at: now,
    })
    .eq('id', findingId)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Write audit log entry
  const { error: logErr } = await supabase
    .from('design_decision_log')
    .insert({
      finding_id: findingId,
      project_id: projectId,
      run_id: finding.run_id,
      lens: finding.lens,
      finding_title: finding.title,
      severity: finding.severity,
      action: status,
      decision_type,
      comment: comment.trim(),
      actioned_by: user.id,
      actioned_at: now,
    })

  if (logErr) {
    // Non-fatal — finding was updated, log it but don't fail the request
    console.error('Decision log insert failed:', logErr.message)
  }

  return NextResponse.json({ ok: true })
}
