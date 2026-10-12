import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, MANAGER_ROLES } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  const auth = await requireRole(MANAGER_ROLES)
  if ('error' in auth) return auth.error
  const supabase = await createClient()

  const { searchParams } = new URL(req.url)
  const weekStart = searchParams.get('weekStart')
  const weekEnd = searchParams.get('weekEnd')
  if (!weekStart || !weekEnd) return NextResponse.json({ error: 'weekStart and weekEnd required' }, { status: 400 })

  // Get all agency entries for this week with discrepancy flag
  const { data: agencyTimesheets } = await supabase
    .from('timesheets')
    .select('id')
    .eq('site_id', siteId)
    .eq('source', 'agency')
    .gte('week_start', weekStart)
    .lte('week_start', weekEnd)

  const agencyTsIds = (agencyTimesheets ?? []).map(t => t.id)
  if (agencyTsIds.length === 0) return NextResponse.json([])

  const { data: agencyEntries } = await supabase
    .from('timesheet_entries')
    .select('id, person_name, person_id, entry_date, hours, discrepancy_flag, discrepancy_note, signed_off_by, signed_off_at, signed_off_name, people:person_id(id, name, role, company)')
    .in('timesheet_id', agencyTsIds)
    .eq('discrepancy_flag', true)

  if (!agencyEntries?.length) return NextResponse.json([])

  // Get diary entries for same week + same people
  const personIds = [...new Set(agencyEntries.map(e => e.person_id).filter(Boolean))]
  const personNames = [...new Set(agencyEntries.map(e => e.person_name))]

  const { data: diaryTimesheets } = await supabase
    .from('timesheets')
    .select('id')
    .eq('site_id', siteId)
    .eq('source', 'diary')
    .gte('week_start', weekStart)
    .lte('week_start', weekEnd)

  const diaryTsIds = (diaryTimesheets ?? []).map(t => t.id)

  let diaryEntries: any[] = []
  if (diaryTsIds.length > 0) {
    const { data } = await supabase
      .from('timesheet_entries')
      .select('person_id, person_name, entry_date, hours')
      .in('timesheet_id', diaryTsIds)
      .or(`person_id.in.(${personIds.join(',')}),person_name.in.(${personNames.map(n => `"${n}"`).join(',')})`)
    diaryEntries = data ?? []
  }

  // Build diary lookup: person_id → date → hours
  const diaryMap = new Map<string, Map<string, number>>()
  for (const d of diaryEntries) {
    const key = d.person_id ?? d.person_name
    if (!diaryMap.has(key)) diaryMap.set(key, new Map())
    const cur = diaryMap.get(key)!.get(d.entry_date) ?? 0
    diaryMap.get(key)!.set(d.entry_date, cur + d.hours)
  }

  // Group agency discrepancy entries by person
  const byPerson = new Map<string, {
    person_id: string | null; person_name: string; person: any
    entries: { id: string; date: string; agency_hours: number; diary_hours: number; diff: number; signed_off_by: string | null; signed_off_at: string | null; signed_off_name: string | null }[]
  }>()

  for (const e of agencyEntries) {
    const key = e.person_id ?? e.person_name
    if (!byPerson.has(key)) {
      const p = Array.isArray(e.people) ? e.people[0] : e.people
      byPerson.set(key, { person_id: e.person_id, person_name: e.person_name, person: p, entries: [] })
    }
    const personKey = e.person_id ?? e.person_name
    const diaryHours = diaryMap.get(personKey)?.get(e.entry_date) ?? 0
    byPerson.get(key)!.entries.push({
      id: e.id,
      date: e.entry_date,
      agency_hours: e.hours,
      diary_hours: diaryHours,
      diff: Math.round((e.hours - diaryHours) * 10) / 10,
      signed_off_by: e.signed_off_by,
      signed_off_at: e.signed_off_at,
      signed_off_name: e.signed_off_name,
    })
  }

  return NextResponse.json([...byPerson.values()])
}
