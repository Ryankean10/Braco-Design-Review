import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireRole, MANAGER_ROLES } from '@/lib/auth'
import * as XLSX from 'xlsx'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const dynamic = 'force-dynamic'

function parseDate(v: unknown): string | null {
  if (!v) return null
  const s = String(v).trim()
  const m = s.match(/(\d{1,2})-([A-Za-z]{3})-(\d{2,4})/)
  if (m) {
    const months: Record<string, number> = {
      jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11
    }
    const mo = months[m[2].toLowerCase()]
    const yr = parseInt(m[3]) + (m[3].length === 2 ? 2000 : 0)
    return new Date(Date.UTC(yr, mo, parseInt(m[1]))).toISOString().slice(0, 10)
  }
  return null
}

function weekStartFromEnding(weekEndISO: string): string {
  const d = new Date(weekEndISO)
  d.setUTCDate(d.getUTCDate() - 6)
  return d.toISOString().slice(0, 10)
}

function dayToDate(dayName: string, weekEndISO: string): string | null {
  const offsets: Record<string, number> = {
    MON:-6, TUE:-5, TUES:-5, WED:-4, THU:-3, THUR:-3, FRI:-2, SAT:-1, SUN:0
  }
  const off = offsets[dayName.toUpperCase().replace(/\.$/, '')]
  if (off === undefined) return null
  const d = new Date(weekEndISO)
  d.setUTCDate(d.getUTCDate() + off)
  return d.toISOString().slice(0, 10)
}

function parseBlock(rows: unknown[][], startRow: number, weekEndISO: string) {
  let headerRow = -1
  for (let r = startRow; r < startRow + 10; r++) {
    if (String((rows[r] as any)?.[0] || '').includes('NAME OF CONTRACTOR')) {
      headerRow = r; break
    }
  }
  if (headerRow < 0) return []

  const dayMap: Record<number, string> = {}
  const headerCols = rows[headerRow] as string[]
  for (let c = 2; c <= 8; c++) {
    const day = String(headerCols[c] || '').trim().toUpperCase()
    if (day && day !== 'S/T' && day !== 'EVE') {
      const date = dayToDate(day, weekEndISO)
      if (date) dayMap[c] = date
    }
  }

  const entries: { name: string; date: string; hours: number }[] = []
  let blankStreak = 0
  for (let r = headerRow + 2; r < headerRow + 20; r++) {
    const row = (rows[r] || []) as string[]
    const name = String(row[0] || '').trim()
    if (!name || name === 'AUTHORISED' || name === 'SIGNATURE') {
      blankStreak++
      if (blankStreak >= 3) break
      continue
    }
    blankStreak = 0

    let hasDayEntries = false
    for (const [col, date] of Object.entries(dayMap)) {
      const h = parseFloat(String(row[Number(col)] || '').trim())
      if (!isNaN(h) && h > 0) {
        entries.push({ name, date, hours: h })
        hasDayEntries = true
      }
    }

    if (!hasDayEntries) {
      const totalHours = parseFloat(String(row[9] || '').trim())
      if (!isNaN(totalHours) && totalHours > 0) {
        entries.push({ name, date: weekEndISO, hours: totalHours })
      }
    }
  }
  return entries
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  const auth = await requireRole(MANAGER_ROLES)
  if ('error' in auth) return auth.error
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buf, { type: 'buffer', raw: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '', raw: false })

  const weekEnd = parseDate((rows[7] as any)?.[10])
  if (!weekEnd) return NextResponse.json({ error: 'Could not find week-ending date in file (expected at row 8, col 11)' }, { status: 422 })

  const weekStart = weekStartFromEnding(weekEnd)

  const b1 = parseBlock(rows, 7, weekEnd)
  const b2 = parseBlock(rows, 34, weekEnd)
  const allEntries = [...b1, ...b2]

  if (allEntries.length === 0) {
    return NextResponse.json({ error: 'No timesheet entries found in file' }, { status: 422 })
  }

  // Load name mappings for this site
  const { data: mappings } = await supabase
    .from('diary_name_mappings')
    .select('raw_name, person_id, no_match')
    .eq('site_id', siteId)
  const mappingMap = new Map((mappings ?? []).map(m => [m.raw_name.toLowerCase(), m]))

  // Load all people for auto-match fallback
  const { data: people } = await supabase.from('people').select('id, name')

  function matchPerson(name: string): string | null {
    const n = name.toLowerCase().trim()
    const existing = mappingMap.get(n)
    if (existing) return existing.no_match ? null : existing.person_id
    for (const p of people ?? []) {
      const pn = (p.name || '').toLowerCase().trim()
      if (pn === n) return p.id
      const pLast = pn.split(' ').pop()
      const nLast = n.split(' ').pop()
      if (pLast && nLast && pLast === nLast && pLast.length > 2) return p.id
    }
    return null
  }

  // Check for existing timesheet this week — upsert
  const { data: existing } = await supabase
    .from('timesheets')
    .select('id')
    .eq('site_id', siteId)
    .eq('week_start', weekStart)
    .eq('source', 'agency')
    .maybeSingle()

  // Upload file to storage
  const storagePath = `${siteId}/${weekStart}/${file.name}`
  const { error: storageErr } = await svc().storage
    .from('timesheets')
    .upload(storagePath, buf, {
      contentType: file.type || 'application/vnd.ms-excel',
      upsert: true,
    })
  if (storageErr) console.warn('Storage upload warning:', storageErr.message)

  let timesheetId: string
  if (existing) {
    timesheetId = existing.id
    // Clear old entries to replace with fresh upload
    await supabase.from('timesheet_entries').delete().eq('timesheet_id', timesheetId)
    await supabase.from('timesheets')
      .update({ file_name: file.name, uploaded_by: user.id, storage_path: storagePath, uploaded_at: new Date().toISOString() })
      .eq('id', timesheetId)
  } else {
    const { data: inserted, error: tsErr } = await supabase
      .from('timesheets')
      .insert({ site_id: siteId, source: 'agency', week_start: weekStart, file_name: file.name, storage_path: storagePath, uploaded_by: user.id })
      .select('id').single()
    if (tsErr) return NextResponse.json({ error: tsErr.message }, { status: 500 })
    timesheetId = inserted.id
  }

  const entryRows = allEntries.map(e => ({
    timesheet_id: timesheetId,
    site_id: siteId,
    person_name: e.name,
    person_id: matchPerson(e.name),
    entry_date: e.date,
    hours: e.hours,
    role: null,
  }))

  const { error: eErr } = await supabase.from('timesheet_entries').insert(entryRows)
  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })

  // Compute discrepancies against diary entries for same week+person
  const { data: diaryEntries } = await supabase
    .from('timesheet_entries')
    .select('person_id, entry_date, hours')
    .eq('site_id', siteId)
    .gte('entry_date', weekStart)
    .lte('entry_date', weekEnd)
    .in('timesheet_id',
      (await supabase.from('timesheets').select('id').eq('site_id', siteId).eq('source', 'diary').gte('week_start', weekStart).lte('week_start', weekEnd)).data?.map(t => t.id) ?? []
    )

  // Flag discrepancies on the newly inserted agency entries
  const diaryMap = new Map<string, number>()
  for (const d of diaryEntries ?? []) {
    if (!d.person_id) continue
    const key = `${d.person_id}:${d.entry_date}`
    diaryMap.set(key, (diaryMap.get(key) ?? 0) + d.hours)
  }

  const toFlag: string[] = []
  const { data: insertedEntries } = await supabase
    .from('timesheet_entries')
    .select('id, person_id, entry_date, hours')
    .eq('timesheet_id', timesheetId)

  for (const e of insertedEntries ?? []) {
    if (!e.person_id) continue
    const key = `${e.person_id}:${e.entry_date}`
    const diaryHours = diaryMap.get(key)
    if (diaryHours !== undefined && Math.abs(diaryHours - e.hours) > 0.5) {
      toFlag.push(e.id)
    }
  }

  if (toFlag.length > 0) {
    await supabase.from('timesheet_entries')
      .update({ discrepancy_flag: true, discrepancy_note: 'Agency hours differ from diary record by >0.5h' })
      .in('id', toFlag)
  }

  const matched = entryRows.filter(e => e.person_id).length
  const unmatched = [...new Set(entryRows.filter(e => !e.person_id).map(e => e.person_name))]

  return NextResponse.json({
    ok: true,
    weekEnd,
    weekStart,
    totalEntries: entryRows.length,
    matched,
    unmatched,
    discrepancies: toFlag.length,
    timesheetId,
    replaced: !!existing,
  })
}
