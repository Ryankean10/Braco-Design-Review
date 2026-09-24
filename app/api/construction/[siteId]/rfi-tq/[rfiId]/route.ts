import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, INTERNAL_ROLES } from '@/lib/auth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ siteId: string; rfiId: string }> }) {
  const { siteId, rfiId } = await params
  const auth = await requireRole(INTERNAL_ROLES)
  if ('error' in auth) return auth.error

  const supabase = await createClient()
  const [{ data: item }, { data: log }] = await Promise.all([
    supabase.from('rfis_tqs').select('*').eq('id', rfiId).eq('site_id', siteId).single(),
    supabase.from('rfi_tq_audit_log').select('*').eq('rfi_tq_id', rfiId).order('created_at'),
  ])

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ...item, audit_log: log ?? [] })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ siteId: string; rfiId: string }> }) {
  const { siteId, rfiId } = await params
  const auth = await requireRole(INTERNAL_ROLES)
  if ('error' in auth) return auth.error

  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', auth.user.id)
    .single()

  const { data: existing } = await supabase
    .from('rfis_tqs')
    .select('*')
    .eq('id', rfiId)
    .eq('site_id', siteId)
    .single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const userName = (profile as any)?.full_name ?? (profile as any)?.email ?? 'Unknown'

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
      user_id: auth.user.id,
      user_name: userName,
      action,
      changes,
    })
  }

  return NextResponse.json(updated)
}
