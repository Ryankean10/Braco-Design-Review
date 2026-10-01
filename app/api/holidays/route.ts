import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
  const { personId, startDate, endDate, daysTaken, description } = await req.json()

  const { data: booking, error } = await supabase.from('holiday_bookings').insert({
    person_id: personId,
    company_id: (profile as any)?.company_id,
    start_date: startDate,
    end_date: endDate,
    days_taken: daysTaken,
    description: description || null,
    status: 'Pending',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ booking })
}
