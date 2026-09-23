import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: profile } = await admin.from('profiles').select('role, company_id').eq('id', user.id).single()
  if (!['admin', 'superadmin', 'project_manager'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { personId, weekStarting, amount } = await req.json()
  if (!personId || !weekStarting) return NextResponse.json({ error: 'personId and weekStarting required' }, { status: 400 })
  const bonus = typeof amount === 'number' ? amount : 50

  // Upsert the weekly_timesheets row with the bonus (must already exist for an approved sheet)
  const { data: existing } = await admin.from('weekly_timesheets')
    .select('id, bonus')
    .eq('person_id', personId)
    .eq('week_starting', weekStarting)
    .maybeSingle()

  if (!existing?.id) return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 })

  const { data, error } = await admin.from('weekly_timesheets')
    .update({ bonus })
    .eq('id', existing.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ timesheet: data })
}
