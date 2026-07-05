import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: entries, error } = await supabase
    .from('timesheet_entries')
    .select('id, entry_date, hours, role, notes, site:construction_sites(id,name), timesheet:timesheets(source,week_start,file_name)')
    .eq('person_id', id)
    .order('entry_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group by week_start + site, aggregate diary vs agency hours
  const weekMap = new Map<string, {
    week_start: string; site_name: string
    diary_hours: number; agency_hours: number
    entries: typeof entries
  }>()

  for (const e of entries ?? []) {
    const tsRaw = Array.isArray(e.timesheet) ? e.timesheet[0] : e.timesheet
    const ts = tsRaw as { source: string; week_start: string; file_name: string | null } | null
    const siteRaw = Array.isArray(e.site) ? e.site[0] : e.site
    const site = siteRaw as { id: string; name: string } | null
    const weekStart = ts?.week_start ?? e.entry_date?.slice(0, 10) ?? 'unknown'
    const siteName = site?.name ?? 'Unknown site'
    const key = `${weekStart}__${siteName}`

    if (!weekMap.has(key)) {
      weekMap.set(key, { week_start: weekStart, site_name: siteName, diary_hours: 0, agency_hours: 0, entries: [] })
    }
    const w = weekMap.get(key)!
    w.entries.push(e)
    if (ts?.source === 'agency') w.agency_hours += e.hours ?? 0
    else w.diary_hours += e.hours ?? 0
  }

  const weeks = [...weekMap.values()].sort((a, b) => b.week_start.localeCompare(a.week_start))
  return NextResponse.json(weeks)
}
