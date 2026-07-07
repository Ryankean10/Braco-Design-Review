import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data } = await supabase
    .from('timesheets')
    .select('id, week_start, file_name, storage_path, uploaded_at, uploaded_by, uploader:profiles!uploaded_by(full_name)')
    .eq('site_id', siteId)
    .eq('source', 'agency')
    .order('week_start', { ascending: false })

  // Annotate each with discrepancy counts
  const ids = (data ?? []).map(t => t.id)
  const { data: flagged } = ids.length ? await supabase
    .from('timesheet_entries')
    .select('timesheet_id, discrepancy_flag, signed_off_by')
    .in('timesheet_id', ids)
    .eq('discrepancy_flag', true)
    : { data: [] }

  const discMap = new Map<string, { total: number; unsigned: number }>()
  for (const e of flagged ?? []) {
    const cur = discMap.get(e.timesheet_id) ?? { total: 0, unsigned: 0 }
    cur.total++
    if (!e.signed_off_by) cur.unsigned++
    discMap.set(e.timesheet_id, cur)
  }

  const result = (data ?? []).map(t => {
    const uploader = Array.isArray(t.uploader) ? t.uploader[0] : t.uploader
    const disc = discMap.get(t.id)
    return {
      id: t.id,
      week_start: t.week_start,
      file_name: t.file_name,
      has_file: !!t.storage_path,
      uploaded_at: t.uploaded_at,
      uploaded_by_name: (uploader as any)?.full_name ?? null,
      discrepancies_total: disc?.total ?? 0,
      discrepancies_unsigned: disc?.unsigned ?? 0,
    }
  })

  return NextResponse.json(result)
}
