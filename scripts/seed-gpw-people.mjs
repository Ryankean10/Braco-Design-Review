// Create missing GPW agency staff and fix name aliases, then re-link all timesheet entries
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const env = {}
for (const l of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([^#=]+)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '')
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// ── 1. Create new people ────────────────────────────────────────────────────
const newPeople = [
  { name: 'Danny McBean',   company: 'GPW', person_group: 'Agency Staff', role: 'Electrician', discipline: 'Electrical' },
  { name: 'Euan Naysmith',  company: 'GPW', person_group: 'Agency Staff', role: 'Electrician', discipline: 'Electrical' },
  { name: 'Harry Grieve',   company: 'GPW', person_group: 'Agency Staff', role: 'Electrician', discipline: 'Electrical' },
  { name: 'Karl Gill',      company: 'GPW', person_group: 'Agency Staff', role: 'Electrician', discipline: 'Electrical' },
  { name: 'Mark Winlow',    company: 'GPW', person_group: 'Agency Staff', role: 'Electrician', discipline: 'Electrical' },
]

console.log('Creating new GPW staff…')
const { data: existing } = await sb.from('people').select('name')
const existingNames = new Set((existing || []).map(p => p.name.toLowerCase()))

for (const p of newPeople) {
  if (existingNames.has(p.name.toLowerCase())) {
    console.log(`  Skip (already exists): ${p.name}`)
    continue
  }
  const { data, error } = await sb.from('people').insert({ ...p, is_active: true }).select('id,name').single()
  if (error) console.error(`  Error creating ${p.name}: ${error.message}`)
  else console.log(`  Created: ${data.name} (${data.id})`)
}

// ── 2. Load all people for alias resolution ─────────────────────────────────
const { data: people } = await sb.from('people').select('id,name')
const byName = new Map(people.map(p => [p.name.toLowerCase(), p]))

// ── 3. Fetch Dyce site ───────────────────────────────────────────────────────
const { data: site } = await sb.from('construction_sites').select('id').ilike('name', '%dyce%').maybeSingle()
if (!site) { console.error('Dyce site not found'); process.exit(1) }

// ── 4. Name aliases: raw diary/agency name → canonical person name ──────────
// Covers both agency XLS spellings and free-text diary variants
const aliases = [
  // Agency XLS spellings
  { raw: 'Lewis Baille',    canonical: 'Lewis Bailie' },
  { raw: 'Owen Gardner',    canonical: 'Owen Gardiner' },
  { raw: 'Rajeev Raj',      canonical: 'Raj Raveev' },
  // Diary free-text variants
  { raw: 'Lewis Baillie',   canonical: 'Lewis Bailie' },
  { raw: 'Rajeeve Raj',     canonical: 'Raj Raveev' },
  { raw: 'Owen Gardiner',   canonical: 'Owen Gardiner' }, // already correct
  { raw: 'Adam Monaghan',   canonical: 'Adam Monaghue' },
]

console.log('\nApplying name aliases…')
for (const { raw, canonical } of aliases) {
  const person = byName.get(canonical.toLowerCase())
  if (!person) { console.log(`  Skip: no person found for canonical "${canonical}"`); continue }

  // Update timesheet_entries
  const { count } = await sb
    .from('timesheet_entries')
    .update({ person_id: person.id })
    .eq('site_id', site.id)
    .eq('person_name', raw)
    .select('id', { count: 'exact', head: true })

  // Upsert diary_name_mapping so future imports resolve it
  await sb.from('diary_name_mappings').upsert(
    { site_id: site.id, raw_name: raw, person_id: person.id, no_match: false },
    { onConflict: 'site_id,raw_name' }
  )

  console.log(`  "${raw}" → "${canonical}" (${person.id})`)
}

// ── 5. Re-link all timesheet entries to newly created people ─────────────────
console.log('\nRe-linking unmatched entries to new people…')
const { data: unlinked } = await sb
  .from('timesheet_entries')
  .select('id,person_name')
  .eq('site_id', site.id)
  .is('person_id', null)

if (!unlinked?.length) { console.log('  No unlinked entries remaining.') }
else {
  // Refresh people map now that new ones are created
  const { data: allPeople } = await sb.from('people').select('id,name')
  const nameMap = new Map(allPeople.map(p => [p.name.toLowerCase(), p]))

  const updates = {}
  for (const e of unlinked) {
    const n = e.person_name.toLowerCase().trim()
    // exact match
    let person = nameMap.get(n)
    // surname match fallback
    if (!person) {
      const nLast = n.split(' ').pop()
      for (const [k, v] of nameMap) {
        if (k.split(' ').pop() === nLast && nLast.length > 2) { person = v; break }
      }
    }
    if (person) {
      if (!updates[person.id]) updates[person.id] = []
      updates[person.id].push(e.id)
    }
  }

  for (const [personId, ids] of Object.entries(updates)) {
    await sb.from('timesheet_entries').update({ person_id: personId }).in('id', ids)
    const name = allPeople.find(p => p.id === personId)?.name
    console.log(`  Linked ${ids.length} entries → ${name}`)
  }

  // Report still-unmatched
  const { data: stillUnlinked } = await sb
    .from('timesheet_entries').select('person_name').eq('site_id', site.id).is('person_id', null)
  const stillNames = [...new Set((stillUnlinked || []).map(e => e.person_name))].sort()
  if (stillNames.length) {
    console.log(`\n  Still unlinked (${stillNames.length} names):`)
    stillNames.forEach(n => console.log(`    - ${n}`))
  } else {
    console.log('\n  All entries linked.')
  }
}

console.log('\nDone.')
