import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const { data: profile } = await admin
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()
  if (!['admin', 'superadmin', 'project_manager'].includes(profile?.role ?? '')) return null
  return { admin, user, profile }
}

async function populateWeeklyTimesheet(
  admin: ReturnType<typeof createAdmin>,
  submission: {
    matched_person_id: string
    company_id: string
    week_starting: string
    days: { date: string; hours_on_site: number; driving_hours: number; working_location: string; comments: string }[]
  }
) {
  // Ensure the weekly_timesheets row exists (preserve status if already created)
  await admin.from('weekly_timesheets')
    .upsert(
      { person_id: submission.matched_person_id, company_id: submission.company_id, week_starting: submission.week_starting, status: 'Submitted' },
      { onConflict: 'person_id,week_starting', ignoreDuplicates: true }
    )

  const { data: tsRow } = await admin
    .from('weekly_timesheets')
    .select('id')
    .eq('person_id', submission.matched_person_id)
    .eq('week_starting', submission.week_starting)
    .single()

  if (!tsRow?.id) return

  // Upsert each worked day into timesheet_days
  for (const day of submission.days) {
    if (!day.hours_on_site && !day.driving_hours) continue

    // Fetch any existing entry so we can merge hours rather than overwrite
    const { data: existing } = await admin
      .from('timesheet_days')
      .select('hours_regular, description')
      .eq('timesheet_id', tsRow.id)
      .eq('work_date', day.date)
      .single()

    const descParts: string[] = []
    if (day.working_location) descParts.push(day.working_location)
    if (day.driving_hours > 0) descParts.push(`Driving: ${day.driving_hours}h`)
    if (day.comments) descParts.push(day.comments)

    await admin.from('timesheet_days')
      .upsert({
        timesheet_id: tsRow.id,
        work_date: day.date,
        hours_regular: (existing?.hours_regular ?? 0) + day.hours_on_site,
        hours_ot1: 0,
        hours_ot2: 0,
        description: [existing?.description, ...descParts].filter(Boolean).join(' · '),
        is_holiday: false,
      }, { onConflict: 'timesheet_id,work_date' })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const update: Record<string, any> = {}

  if (body.status === 'approved') {
    update.status = 'approved'
    update.approved_by = ctx.user.id
    update.approved_at = new Date().toISOString()
  } else if (body.status === 'rejected') {
    update.status = 'rejected'
    update.rejection_reason = body.rejection_reason ?? null
    update.approved_by = ctx.user.id
    update.approved_at = new Date().toISOString()
  } else {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { data: submission } = await ctx.admin
    .from('timesheet_submissions')
    .select('matched_person_id, company_id, week_starting, days')
    .eq('id', id)
    .single()

  const { error } = await ctx.admin
    .from('timesheet_submissions')
    .update(update)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (body.status === 'approved' && submission?.matched_person_id && submission?.company_id) {
    try {
      await populateWeeklyTimesheet(ctx.admin, submission as any)
    } catch {
      // Don't block the approval response
    }
  }

  return NextResponse.json({ ok: true })
}
