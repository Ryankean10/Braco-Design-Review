// One-time backfill: reads site_daily_logs.personnel and seeds timesheet_entries
// Run: node scripts/backfill-timesheets.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env.local
const envPath = resolve(process.cwd(), '.env.local')
const envLines = readFileSync(envPath, 'utf8').split('\n')
const env = {}
for (const line of envLines) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '')
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
)

// Helper: get Monday of a given date string
function weekStart(dateStr) {
  const d = new Date(dateStr)
  const day = d.getUTCDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

// Fuzzy match: return person_id or null
function matchPerson(name, people) {
  const n = name.toLowerCase().trim()
  const nParts = n.split(/\s+/)
  const nLast = nParts[nParts.length - 1]

  for (const p of people) {
    const pn = (p.name ?? '').toLowerCase().trim()
    if (pn === n) return p.id
    const pParts = pn.split(/\s+/)
    const pLast = pParts[pParts.length - 1]
    // surname match
    if (nLast && pLast && nLast === pLast) return p.id
    // initial+surname: "B. Melrose" vs "Ben Melrose"
    if (nParts.length === 2 && nParts[0].replace('.','').length === 1) {
      const initial = nParts[0].replace('.','').toLowerCase()
      if (pLast === nLast && pParts[0]?.[0] === initial) return p.id
    }
  }
  return null
}

async function run() {
  // Fetch all people
  const { data: people, error: pErr } = await supabase.from('people').select('id, name')
  if (pErr) { console.error('Failed to fetch people:', pErr.message); process.exit(1) }
  console.log(`Loaded ${people.length} people`)

  // Fetch all daily logs with personnel
  const { data: logs, error: lErr } = await supabase
    .from('site_daily_logs')
    .select('id, site_id, log_date, personnel')
    .not('personnel', 'is', null)
    .order('log_date')
  if (lErr) { console.error('Failed to fetch logs:', lErr.message); process.exit(1) }

  const logsWithPeople = logs.filter(l => Array.isArray(l.personnel) && l.personnel.length > 0)
  console.log(`Found ${logsWithPeople.length} logs with personnel entries`)

  // Group logs by site_id + week_start to create one timesheet per week/site
  const weekMap = new Map()
  for (const log of logsWithPeople) {
    const ws = weekStart(log.log_date)
    const key = `${log.site_id}__${ws}`
    if (!weekMap.has(key)) weekMap.set(key, { site_id: log.site_id, week_start: ws, logs: [] })
    weekMap.get(key).logs.push(log)
  }
  console.log(`Grouped into ${weekMap.size} site-weeks`)

  let created = 0
  let skipped = 0
  let entries = 0

  for (const { site_id, week_start: ws, logs: weekLogs } of weekMap.values()) {
    // Check if a diary timesheet already exists for this site/week
    const { data: existing } = await supabase
      .from('timesheets')
      .select('id')
      .eq('site_id', site_id)
      .eq('week_start', ws)
      .eq('source', 'diary')
      .maybeSingle()

    let tsId
    if (existing) {
      tsId = existing.id
      skipped++
    } else {
      const { data: ts, error: tsErr } = await supabase
        .from('timesheets')
        .insert({ site_id, source: 'diary', week_start: ws, notes: 'Backfilled from daily log entries' })
        .select('id')
        .single()
      if (tsErr) { console.error(`Failed to create timesheet for ${site_id} ${ws}:`, tsErr.message); continue }
      tsId = ts.id
      created++
    }

    // Build entries for each person in each day's log
    const entryRows = []
    for (const log of weekLogs) {
      for (const p of log.personnel) {
        if (!p.name?.trim()) continue
        const personId = matchPerson(p.name, people)
        entryRows.push({
          timesheet_id: tsId,
          site_id,
          person_name: p.name,
          person_id: personId ?? null,
          entry_date: log.log_date,
          hours: p.hours ?? null,
          role: p.role ?? null,
          notes: p.note ?? null,
        })
      }
    }

    if (entryRows.length > 0) {
      // Delete old entries for this timesheet to avoid duplicates on re-run
      await supabase.from('timesheet_entries').delete().eq('timesheet_id', tsId)
      const { error: eErr } = await supabase.from('timesheet_entries').insert(entryRows)
      if (eErr) { console.error(`Failed to insert entries for ${tsId}:`, eErr.message) }
      else entries += entryRows.length
    }
  }

  console.log(`\nDone.`)
  console.log(`  Timesheets created: ${created}`)
  console.log(`  Timesheets already existed (re-seeded entries): ${skipped}`)
  console.log(`  Entries written: ${entries}`)

  // Report unmatched names
  const unmatched = new Set()
  for (const log of logsWithPeople) {
    for (const p of log.personnel) {
      if (p.name?.trim() && !matchPerson(p.name, people)) unmatched.add(p.name)
    }
  }
  if (unmatched.size > 0) {
    console.log(`\n  Unmatched names (no person_id assigned):`)
    for (const n of [...unmatched].sort()) console.log(`    - ${n}`)
  }
}

run().catch(e => { console.error(e); process.exit(1) })
