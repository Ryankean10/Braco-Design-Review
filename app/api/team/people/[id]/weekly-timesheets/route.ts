import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { data, error } = await admin
    .from('weekly_timesheets')
    .select('*, timesheet_days(*)')
    .eq('person_id', id)
    .order('week_starting', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Also fetch approved holiday_bookings for this person so caller can compute holiday days per week
  const { data: holidays } = await admin
    .from('holiday_bookings')
    .select('start_date, end_date, days_taken, status')
    .eq('person_id', id)
    .eq('status', 'Approved')

  return NextResponse.json({ timesheets: data ?? [], holidays: holidays ?? [] })
}
