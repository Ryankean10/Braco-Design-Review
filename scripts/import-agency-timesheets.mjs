// Import OCU Dyce agency XLS timesheets into Supabase
// Run: node scripts/import-agency-timesheets.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { resolve, join } from 'path'
import XLSX from 'xlsx'

// Load .env.local
const envLines = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')
const env = {}
for (const line of envLines) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '')
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const DYCE_FILES = [
  'OCU Dyce Timesheet.xls',
  'OCU Dyce Timesheet (1).xls','OCU Dyce Timesheet (2).xls','OCU Dyce Timesheet (3).xls',
  'OCU Dyce Timesheet (4).xls','OCU Dyce Timesheet (5).xls','OCU Dyce Timesheet (6).xls',
  'OCU Dyce Timesheet (7).xls','OCU Dyce Timesheet (8).xls','OCU Dyce Timesheet (9).xls',
  'OCU Dyce Timesheet (10).xls','OCU Dyce Timesheet (11).xls','OCU Dyce Timesheet (12).xls',
  'OCU Dyce Timesheet (13).xls',
]
const DOWNLOADS = 'C:/Users/admin/Downloads'

function parseDate(v) {
  if (!v) return null
  const s = String(v).trim()
  const m = s.match(/(\d{1,2})-([A-Za-z]{3})-(\d{2,4})/)
  if (m) {
    const months = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 }
    const mo = months[m[2].toLowerCase()]
    const yr = parseInt(m[3]) + (m[3].length === 2 ? 2000 : 0)
    const d = new Date(Date.UTC(yr, mo, parseInt(m[1])))
    return d.toISOString().slice(0, 10)
  }
  return null
}

function weekStartFromEnding(weekEndISO) {
  // week ending = Sunday; week start = Monday 6 days earlier
  const d = new Date(weekEndISO)
  d.setUTCDate(d.getUTCDate() - 6)
  return d.toISOString().slice(0, 10)
}

// Map day name + week-ending to actual date
function dayToDate(dayName, weekEndISO) {
  // weekEnd is Sunday; Mon = -6, Tue = -5, Wed = -4, Thu = -3, Fri = -2, Sat = -1, Sun = 0
  const offsets = { MON:-6, TUE:-5, TUES:-5, WED:-4, THU:-3, THUR:-3, FRI:-2, SAT:-1, SUN:0 }
  const off = offsets[dayName.toUpperCase().replace(/\.$/, '')]
  if (off === undefined) return null
  const d = new Date(weekEndISO)
  d.setUTCDate(d.getUTCDate() + off)
  return d.toISOString().slice(0, 10)
}

function parseBlock(rows, startRow, weekEndISO) {
  // Find day header row (contains "NAME OF CONTRACTOR")
  let headerRow = -1
  for (let r = startRow; r < startRow + 10; r++) {
    if (String(rows[r]?.[0] || '').includes('NAME OF CONTRACTOR')) { headerRow = r; break }
  }
  if (headerRow < 0) return []

  // Read day column map from header
  const dayMap = {} // col index → date
  const headerCols = rows[headerRow]
  for (let c = 2; c <= 8; c++) {
    const day = String(headerCols[c] || '').trim().toUpperCase()
    if (day && day !== 'S/T' && day !== 'EVE') {
      const date = dayToDate(day, weekEndISO)
      if (date) dayMap[c] = date
    }
  }

  const totalCol = 9 // S/T column

  // Person rows: next row after header+1 (skip OT row), up to AUTHORISED or blank streak
  const entries = []
  let blankStreak = 0
  for (let r = headerRow + 2; r < headerRow + 15; r++) {
    const row = rows[r] || []
    const name = String(row[0] || '').trim()
    if (!name || name === 'AUTHORISED' || name === 'SIGNATURE') {
      blankStreak++
      if (blankStreak >= 3) break
      continue
    }
    blankStreak = 0

    // Total hours from S/T column
    const totalStr = String(row[totalCol] || '').trim()
    const totalHours = parseFloat(totalStr)

    // Individual day hours
    for (const [col, date] of Object.entries(dayMap)) {
      const h = parseFloat(String(row[col] || '').trim())
      if (!isNaN(h) && h > 0) {
        entries.push({ name, date, hours: h })
      }
    }

    // If no individual day entries but has a total, create one entry with the week-end date
    const hasDayEntries = Object.keys(dayMap).some(c => {
      const h = parseFloat(String(row[c] || '').trim())
      return !isNaN(h) && h > 0
    })
    if (!hasDayEntries && !isNaN(totalHours) && totalHours > 0) {
      entries.push({ name, date: weekEndISO, hours: totalHours })
    }
  }
  return entries
}

async function run() {
  // Find Dyce site
  const { data: site } = await supabase
    .from('construction_sites').select('id,name').ilike('name', '%dyce%').maybeSingle()
  if (!site) { console.error('Dyce site not found'); process.exit(1) }
  console.log(`Site: ${site.name} (${site.id})`)

  // Load people for matching
  const { data: people } = await supabase.from('people').select('id,name')
  const { data: existingMappings } = await supabase
    .from('diary_name_mappings').select('raw_name,person_id,no_match').eq('site_id', site.id)
  const mappingMap = new Map((existingMappings || []).map(m => [m.raw_name.toLowerCase(), m]))

  function matchPerson(name) {
    const n = name.toLowerCase().trim()
    // Check existing confirmed mappings first
    if (mappingMap.has(n)) return mappingMap.get(n).person_id
    // Auto-match by name/surname
    for (const p of people) {
      const pn = (p.name || '').toLowerCase().trim()
      if (pn === n) return p.id
      const pLast = pn.split(' ').pop()
      const nLast = n.split(' ').pop()
      if (pLast && nLast && pLast === nLast && pLast.length > 2) return p.id
    }
    return null
  }

  let totalCreated = 0, totalEntries = 0
  const allUnmatched = new Set()

  for (const fileName of DYCE_FILES) {
    const filePath = join(DOWNLOADS, fileName)
    let wb
    try { wb = XLSX.readFile(filePath) } catch { console.warn(`  Skip (not found): ${fileName}`); continue }

    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false })

    // Block 1: week ending at rows[7][10]
    const b1WeekEnd = parseDate(rows[7]?.[10])
    if (!b1WeekEnd) { console.warn(`  No date in ${fileName}`); continue }

    const weekEnd = b1WeekEnd
    const weekStartISO = weekStartFromEnding(weekEnd)

    console.log(`\n${fileName}: week ending ${weekEnd}`)

    // Parse both blocks using the same week-end (block2 rarely has its own date)
    const b1Entries = parseBlock(rows, 7, weekEnd)
    const b2Entries = parseBlock(rows, 34, weekEnd)
    const allEntries = [...b1Entries, ...b2Entries]

    console.log(`  ${allEntries.length} person-day entries found`)

    if (allEntries.length === 0) continue

    // Check for existing agency timesheet for this week, insert if not present
    const { data: existing } = await supabase
      .from('timesheets')
      .select('id')
      .eq('site_id', site.id)
      .eq('week_start', weekStartISO)
      .eq('source', 'agency')
      .maybeSingle()

    let ts
    if (existing) {
      ts = existing
      console.log(`  Using existing timesheet ${ts.id}`)
    } else {
      const { data: inserted, error: tsErr } = await supabase
        .from('timesheets')
        .insert({ site_id: site.id, source: 'agency', week_start: weekStartISO, file_name: fileName, notes: 'Imported from GPW agency timesheet' })
        .select('id').single()
      if (tsErr) { console.error(`  Timesheet insert error: ${tsErr.message}`); continue }
      ts = inserted
    }
    totalCreated++

    // Delete existing entries for this timesheet to allow re-import
    await supabase.from('timesheet_entries').delete().eq('timesheet_id', ts.id)

    // Build entry rows
    const entryRows = allEntries.map(e => {
      const personId = matchPerson(e.name)
      if (!personId) allUnmatched.add(e.name)
      return {
        timesheet_id: ts.id,
        site_id: site.id,
        person_name: e.name,
        person_id: personId,
        entry_date: e.date,
        hours: e.hours,
        role: null,
      }
    })

    const { error: eErr } = await supabase.from('timesheet_entries').insert(entryRows)
    if (eErr) { console.error(`  Entry insert error: ${eErr.message}`); continue }
    totalEntries += entryRows.length
    console.log(`  Inserted ${entryRows.length} entries (ts: ${ts.id})`)
  }

  console.log(`\n=== Done ===`)
  console.log(`Timesheets: ${totalCreated}`)
  console.log(`Entries:    ${totalEntries}`)
  if (allUnmatched.size > 0) {
    console.log(`\nUnmatched names (no person_id):`)
    for (const n of [...allUnmatched].sort()) console.log(`  - ${n}`)
  }
}

run().catch(e => { console.error(e); process.exit(1) })
