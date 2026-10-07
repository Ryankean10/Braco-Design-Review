import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function countWorkingDays(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  let count = 0
  const cur = new Date(s)
  while (cur <= e) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  const { personId, startDate, endDate, notes } = await req.json()

  if (!personId || !startDate || !endDate) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')

  if (end < start) {
    return NextResponse.json({ error: 'End date must be on or after start date' }, { status: 400 })
  }

  const db = admin()

  const { data: person, error: personErr } = await db
    .from('people')
    .select('id, name, email, company_id')
    .eq('id', personId)
    .single()

  if (personErr || !person) {
    return NextResponse.json({ error: 'Person not found' }, { status: 404 })
  }

  const daysTaken = countWorkingDays(startDate, endDate)

  const { data: booking, error } = await db
    .from('holiday_bookings')
    .insert({
      person_id: personId,
      company_id: (person as any).company_id,
      start_date: startDate,
      end_date: endDate,
      days_taken: daysTaken,
      description: notes?.trim() || null,
      status: 'Pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ booking, daysTaken })
}
