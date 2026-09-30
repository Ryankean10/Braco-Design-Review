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

function getMondayStr(dateStr: string): string {
  const d = new Date(dateStr)
  // Parse as local date (avoid UTC shift)
  const parts = dateStr.split('-').map(Number)
  const local = new Date(parts[0], parts[1] - 1, parts[2])
  const day = local.getDay()
  const diff = day === 0 ? -6 : 1 - day
  local.setDate(local.getDate() + diff)
  const y = local.getFullYear()
  const m = String(local.getMonth() + 1).padStart(2, '0')
  const dd = String(local.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

async function populateWeeklyTimesheet(
  admin: ReturnType<typeof createAdmin>,
  submission: {
    matched_person_id: string
    company_id: string
    work_date: string
    hours_on_site: number
    driving_hours: number
    working_location: string | null
    comments: string | null
  }
) {
  const weekStarting = getMondayStr(submission.work_date)

  // Insert the weekly timesheet row if it doesn't exist yet (preserves existing status)
  await admin.from('weekly_timesheets')
    .upsert(
      { person_id: submission.matched_person_id, company_id: submission.company_id, week_starting: weekStarting, status: 'Submitted' },
      { onConflict: 'person_id,week_starting', ignoreDuplicates: true }
    )

  // Fetch the id (whether just created or already existed)
  const { data: tsRow } = await admin
    .from('weekly_timesheets')
    .select('id')
    .eq('person_id', submission.matched_person_id)
    .eq('week_starting', weekStarting)
    .single()

  if (!tsRow?.id) return

  // Build description from location + driving + comments
  const descParts: string[] = []
  if (submission.working_location) descParts.push(submission.working_location)
  if (submission.driving_hours > 0) descParts.push(`Driving: ${submission.driving_hours}h`)
  if (submission.comments) descParts.push(submission.comments)

  // Upsert the day entry — adds hours_on_site as regular hours
  // If a day entry already exists, merge (don't overwrite with 0)
  const { data: existing } = await admin
    .from('timesheet_days')
    .select('hours_regular, description')
    .eq('timesheet_id', tsRow.id)
    .eq('work_date', submission.work_date)
    .single()

  await admin.from('timesheet_days')
    .upsert({
      timesheet_id: tsRow.id,
      work_date: submission.work_date,
      hours_regular: (existing?.hours_regular ?? 0) + submission.hours_on_site,
      hours_ot1: 0,
      hours_ot2: 0,
      description: [existing?.description, ...descParts].filter(Boolean).join(' · '),
      is_holiday: false,
    }, { onConflict: 'timesheet_id,work_date' })
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

  // Fetch the submission before updating so we have the data
  const { data: submission } = await ctx.admin
    .from('timesheet_submissions')
    .select('matched_person_id, company_id, work_date, hours_on_site, driving_hours, working_location, comments')
    .eq('id', id)
    .single()

  const { error } = await ctx.admin
    .from('timesheet_submissions')
    .update(update)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // On approval, populate the weekly timesheet so hours appear in the Team tab
  if (body.status === 'approved' && submission?.matched_person_id && submission?.company_id) {
    try {
      await populateWeeklyTimesheet(ctx.admin, submission as any)
    } catch {
      // Don't block the approval if timesheet population fails
    }
  }

  return NextResponse.json({ ok: true })
}
