import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; rfiId: string }> }) {
  const { id: projectId, rfiId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const [{ data: item }, { data: log }] = await Promise.all([
    supabase.from('rfis_tqs').select('*').eq('id', rfiId).eq('project_id', projectId).single(),
    supabase.from('rfi_tq_audit_log').select('*').eq('rfi_tq_id', rfiId).order('created_at'),
  ])

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ...item, audit_log: log ?? [] })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; rfiId: string }> }) {
  const { id: projectId, rfiId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  const role = (profile as any)?.role ?? ''
  if (!['superadmin', 'admin', 'engineer', 'project_manager'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: existing } = await supabase
    .from('rfis_tqs')
    .select('*')
    .eq('id', rfiId)
    .eq('project_id', projectId)
    .single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const userName = (profile as any)?.full_name ?? (profile as any)?.email ?? 'Unknown'

  // Compute sla_expires_at if submitting to client
  const updates: Record<string, unknown> = { ...body }
  if (body.status === 'submitted' && body.response_sla_days && !existing.submitted_to_client_at) {
    const now = new Date()
    updates.submitted_to_client_at = now.toISOString()
    const expires = new Date(now)
    expires.setDate(expires.getDate() + body.response_sla_days)
    updates.sla_expires_at = expires.toISOString()
  }
  if (body.status === 'response_received' && !existing.response_received_at) {
    updates.response_received_at = new Date().toISOString()
  }
  if (body.status === 'sent_to_team' && !existing.sent_to_team_at) {
    updates.sent_to_team_at = new Date().toISOString()
  }
  if (body.status === 'closed' && !existing.closed_at) {
    updates.closed_at = new Date().toISOString()
  }

  const { data: updated, error } = await supabase
    .from('rfis_tqs')
    .update(updates)
    .eq('id', rfiId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Build audit changes array
  const changes: { field: string; old_value: unknown; new_value: unknown }[] = []
  const AUDIT_FIELDS = [
    'status','title','description','to_contact','from_contact','number','type',
    'date_sent','date_received','document_reference','document_title',
    'proposed_solution','cost_impact','programme_impact','is_scope_change',
    'response_required_by','response_sla_days','client_response',
    'contractor_name','possible_solutions',
  ]
  for (const field of AUDIT_FIELDS) {
    if (field in body && JSON.stringify((existing as any)[field]) !== JSON.stringify(body[field])) {
      changes.push({ field, old_value: (existing as any)[field], new_value: body[field] })
    }
  }

  if (changes.length > 0) {
    const action = changes.some(c => c.field === 'status') ? 'status_changed' : 'field_updated'
    await supabase.from('rfi_tq_audit_log').insert({
      rfi_tq_id: rfiId,
      user_id: user.id,
      user_name: userName,
      action,
      changes,
    })
  }

  // Notify all internal project members when SLA is set (so they know chase date)
  if (updates.sla_expires_at && body.status === 'submitted') {
    const { data: members } = await supabase
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId)
    const notifRows = (members ?? [])
      .filter((m: any) => m.user_id !== user.id)
      .map((m: any) => ({
        user_id: m.user_id,
        project_id: projectId,
        title: `${updated.type} ${updated.number} — response due`,
        body: `${updated.title}: client response due by ${new Date(updates.sla_expires_at as string).toLocaleDateString('en-GB')}`,
      }))
    if (notifRows.length > 0) await supabase.from('notifications').insert(notifRows)
  }

  return NextResponse.json(updated)
}
