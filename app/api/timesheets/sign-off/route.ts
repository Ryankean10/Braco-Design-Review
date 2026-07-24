import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: profile } = await admin.from('profiles').select('role, full_name, company_id').eq('id', user.id).single()
  const role = profile?.role ?? ''
  const byName = profile?.full_name ?? profile?.email ?? 'Unknown'

  const { personId, weekStarting, action, notes } = await req.json()
  // action: 'Submitted' | 'Approved' | 'Rejected'

  // Permission check
  if (action === 'Approved' || action === 'Rejected') {
    if (!['admin', 'superadmin', 'project_manager'].includes(role)) {
      return NextResponse.json({ error: 'Only admin or PM can sign off timesheets' }, { status: 403 })
    }
  }

  // Upsert the weekly timesheet record
  const { data: existing } = await admin.from('weekly_timesheets')
    .select('id, status, sign_off_history')
    .eq('person_id', personId)
    .eq('week_starting', weekStarting)
    .maybeSingle()

  const previousStatus = existing?.status ?? 'Draft'

  // Override guard — only admin/superadmin can change an Approved timesheet
  if (previousStatus === 'Approved' && !['admin', 'superadmin'].includes(role)) {
    return NextResponse.json({ error: 'Only admin can override an approved timesheet' }, { status: 403 })
  }

  const historyEntry = {
    action,
    status: action,
    by_id: user.id,
    by_name: byName,
    at: new Date().toISOString(),
    notes: notes || null,
    previous_status: previousStatus,
  }

  const newHistory = [...(existing?.sign_off_history ?? []), historyEntry]

  const patch: Record<string, unknown> = {
    status: action,
    sign_off_history: newHistory,
  }

  if (action === 'Approved' || action === 'Rejected') {
    patch.signed_off_by = user.id
    patch.signed_off_by_name = byName
    patch.signed_off_at = new Date().toISOString()
    patch.sign_off_notes = notes || null
  }

  let timesheet
  if (existing?.id) {
    const { data } = await admin.from('weekly_timesheets').update(patch).eq('id', existing.id).select('*, timesheet_days(*)').single()
    timesheet = data
  } else {
    const { data } = await admin.from('weekly_timesheets').insert({
      person_id: personId,
      week_starting: weekStarting,
      company_id: profile?.company_id,
      ...patch,
    }).select('*, timesheet_days(*)').single()
    timesheet = data
  }

  return NextResponse.json({ timesheet: { ...timesheet, days: timesheet?.timesheet_days ?? [] } })
}
