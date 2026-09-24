import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, MANAGER_ROLES } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireRole(MANAGER_ROLES)
  if ('error' in auth) return auth.error
  const supabase = await createClient()

  const { data: entries, error } = await supabase
    .from('timesheet_entries')
    .select(`
      id, entry_date, hours, role, notes,
      discrepancy_flag, discrepancy_note,
      signed_off_by, signed_off_at, signed_off_name,
      site:construction_sites(id,name),
      timesheet:timesheets(source,week_start,file_name)
    `)
    .eq('person_id', id)
    .order('entry_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group by week_start + site
  const weekMap = new Map<string, {
    week_start: string; site_name: string; site_id: string
    diary_hours: number; agency_hours: number
    diary_entries: typeof entries; agency_entries: typeof entries
  }>()

  for (const e of entries ?? []) {
    const tsRaw = Array.isArray(e.timesheet) ? e.timesheet[0] : e.timesheet
    const ts = tsRaw as { source: string; week_start: string; file_name: string | null } | null
    const siteRaw = Array.isArray(e.site) ? e.site[0] : e.site
    const site = siteRaw as { id: string; name: string } | null
    const weekStart = ts?.week_start ?? e.entry_date?.slice(0, 10) ?? 'unknown'
    const siteName = site?.name ?? 'Unknown site'
    const siteId = site?.id ?? ''
    const key = `${weekStart}__${siteId}`

    if (!weekMap.has(key)) {
      weekMap.set(key, { week_start: weekStart, site_name: siteName, site_id: siteId, diary_hours: 0, agency_hours: 0, diary_entries: [], agency_entries: [] })
    }
    const w = weekMap.get(key)!
    if (ts?.source === 'agency') { w.agency_hours += e.hours ?? 0; w.agency_entries.push(e) }
    else { w.diary_hours += e.hours ?? 0; w.diary_entries.push(e) }
  }

  const weeks = [...weekMap.values()]
    .map(w => ({
      ...w,
      discrepancy: w.diary_hours > 0 && w.agency_hours > 0
        ? Math.abs(w.diary_hours - w.agency_hours)
        : 0,
      all_signed_off: [...w.diary_entries, ...w.agency_entries].every(e => (e as any).signed_off_at),
    }))
    .sort((a, b) => b.week_start.localeCompare(a.week_start))

  return NextResponse.json(weeks)
}
