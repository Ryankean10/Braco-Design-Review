/**
 * Setup Braco team — creates new people + appoints all relevant staff to Braco
 * Run: node scripts/setup-braco-team.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const envLines = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')
const env = {}
for (const line of envLines) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '')
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const BRACO_SITE_ID = 'b7bc5e4a-86eb-41e5-ae34-c3511b6420a1'
const APPOINTED_BY = '827cfc54-690b-4ba0-9520-1a42c00f4569'
const START_DATE = '2026-04-01'  // Braco civils mobilisation

// ── New staff to create ──────────────────────────────────────────────────────
// Derived from 53 diaries — visitor placeholders excluded
const NEW_STAFF = [
  { name: 'David Burns',       role: 'Site Agent',                  discipline: 'Civils',    company: 'OCU', person_group: 'OCU Site Management', is_manager: true  },
  { name: 'Graham McPhail',    role: 'Civils Ganger',               discipline: 'Civils',    company: 'OCU', person_group: 'OCU Site Management', is_manager: false },
  { name: 'Andy Turvey',       role: 'Civils Supervisor',           discipline: 'Civils',    company: 'OCU', person_group: 'OCU Site Management', is_manager: true  },
  { name: 'Jim Barry',         role: 'Civils Manager',              discipline: 'Civils',    company: 'OCU', person_group: 'OCU Site Management', is_manager: true  },
  { name: 'Kyle Galloway',     role: 'Plant Operator / Labourer',   discipline: 'Civils',    company: 'OCU', person_group: 'OCU Civils Staff',     is_manager: false },
  { name: 'Lee McPhail',       role: 'Labourer',                    discipline: 'Civils',    company: 'OCU', person_group: 'OCU Civils Staff',     is_manager: false },
  { name: 'Jack Anderson',     role: 'Plant Operator / Labourer',   discipline: 'Civils',    company: 'OCU', person_group: 'OCU Civils Staff',     is_manager: false },
  { name: 'Glen Ross',         role: 'Labourer',                    discipline: 'Civils',    company: 'OCU', person_group: 'OCU Civils Staff',     is_manager: false },
  { name: 'Darren Kennedy',    role: 'Labourer',                    discipline: 'Civils',    company: 'OCU', person_group: 'OCU Civils Staff',     is_manager: false },
  { name: 'Jim Ritchie',       role: 'Plant Operator',              discipline: 'Civils',    company: 'OCU', person_group: 'OCU Civils Staff',     is_manager: false },
  { name: 'Calum Burns',       role: 'Labourer',                    discipline: 'Civils',    company: 'OCU', person_group: 'OCU Civils Staff',     is_manager: false },
  { name: 'Jamie Gaspar',      role: 'Labourer',                    discipline: 'Civils',    company: 'OCU', person_group: 'OCU Civils Staff',     is_manager: false },
  { name: 'Kevin Duffy',       role: 'Labourer',                    discipline: 'Civils',    company: 'OCU', person_group: 'OCU Civils Staff',     is_manager: false },
  { name: 'John Daly',         role: 'Labourer',                    discipline: 'Civils',    company: 'OCU', person_group: 'OCU Civils Staff',     is_manager: false },
  { name: 'Flannery Fitter',   role: 'Fitter / Labourer',           discipline: 'Civils',    company: 'OCU', person_group: 'OCU Civils Staff',     is_manager: false },
  { name: 'Emily Eadington',   role: 'Engineer',                    discipline: 'Civils',    company: 'OCU', person_group: 'Project Staff',        is_manager: false },
  { name: 'Ewan Martin',       role: 'Engineer',                    discipline: 'Civils',    company: 'OCU', person_group: 'Project Staff',        is_manager: false },
  { name: 'Joel Constantine',  role: 'Site Engineer',               discipline: 'Civils',    company: 'OCU', person_group: 'Project Staff',        is_manager: false },
  { name: 'Stewart Constantine', role: 'Senior Site Engineer',      discipline: 'Civils',    company: 'OCU', person_group: 'Project Staff',        is_manager: false },
  { name: 'Jonathan Calder',   role: 'Visiting Engineer',           discipline: 'Civils',    company: 'External', person_group: 'Subcontractors',  is_manager: false },
  { name: 'Richard Goddard',   role: 'Visiting Engineer',           discipline: 'Civils',    company: 'External', person_group: 'Subcontractors',  is_manager: false },
  { name: 'Karen McLeod',      role: 'Site Visitor',                discipline: 'Other',     company: 'External', person_group: 'Subcontractors',  is_manager: false },
  // First-name-only workers — create as-is so they appear on cards
  { name: 'Euan (Braco)',      role: 'Labourer',                    discipline: 'Civils',    company: 'OCU', person_group: 'OCU Civils Staff',     is_manager: false },
  { name: 'Luca Jones',        role: 'Labourer',                    discipline: 'Civils',    company: 'OCU', person_group: 'OCU Civils Staff',     is_manager: false },
  { name: 'Jona (Braco)',      role: 'Labourer',                    discipline: 'Civils',    company: 'OCU', person_group: 'OCU Civils Staff',     is_manager: false },
  { name: 'Kevin (Braco)',     role: 'Labourer',                    discipline: 'Civils',    company: 'OCU', person_group: 'OCU Civils Staff',     is_manager: false },
  { name: 'Petros (Braco)',    role: 'Labourer',                    discipline: 'Civils',    company: 'OCU', person_group: 'OCU Civils Staff',     is_manager: false },
]

// ── Existing staff to match + appoint ────────────────────────────────────────
// Maps diary raw name → existing DB name (for fuzzy matches / typos)
const EXISTING_MATCHES = {
  'Max Ragsdale':  'Max Ragdale',   // diary spells with 's', DB without
  'Ryan Kean':     'Ryan Kean',
  'Stuart Paterson': 'Stuart Paterson',  // Construction Manager, may visit
  'Andrew McInnes': 'Andrew McInnes',    // Project Engineer
}

// Diary name → canonical person name (for diary_name_mappings)
// These also cover the Andy Turver/Turvey double spelling
const DIARY_NAME_ALIASES = [
  { raw: 'Andy Turver',          canonical: 'Andy Turvey' },
  { raw: 'Andy Turvey',          canonical: 'Andy Turvey' },
  { raw: 'Luca',                 canonical: 'Luca Jones' },
  { raw: 'Euan',                 canonical: 'Euan (Braco)' },
  { raw: 'Jona',                 canonical: 'Jona (Braco)' },
  { raw: 'Kevin',                canonical: 'Kevin (Braco)' },
  { raw: 'Petros',               canonical: 'Petros (Braco)' },
  { raw: 'Max Ragsdale',         canonical: 'Max Ragdale' },   // existing person
  { raw: 'Ryan Kean',            canonical: 'Ryan Kean' },
]

async function run() {
  // ── 1. Load existing people ────────────────────────────────────────────────
  const { data: existing } = await sb.from('people').select('id, name')
  const byName = {}
  for (const p of existing ?? []) byName[p.name.trim().toLowerCase()] = p

  // ── 2. Load existing Braco appointments ───────────────────────────────────
  const { data: existingAppts } = await sb
    .from('job_appointments')
    .select('person_id')
    .eq('site_id', BRACO_SITE_ID)
  const alreadyAppointed = new Set((existingAppts ?? []).map(a => a.person_id))

  console.log(`\nExisting people: ${existing?.length}`)
  console.log(`Already appointed to Braco: ${alreadyAppointed.size}\n`)

  // ── 3. Create new staff ────────────────────────────────────────────────────
  const nameToId = {}  // canonical name → person_id

  // Seed with existing
  for (const p of existing ?? []) nameToId[p.name.trim()] = p.id

  let created = 0, skipped = 0
  for (const s of NEW_STAFF) {
    const key = s.name.trim().toLowerCase()
    if (byName[key]) {
      console.log(`  SKIP (exists): ${s.name}`)
      nameToId[s.name] = byName[key].id
      skipped++
      continue
    }
    const { data, error } = await sb.from('people').insert({
      name: s.name,
      role: s.role,
      discipline: s.discipline,
      company: s.company,
      person_group: s.person_group,
      is_active: true,
    }).select('id').single()

    if (error) {
      console.error(`  ERROR creating ${s.name}: ${error.message}`)
    } else {
      nameToId[s.name] = data.id
      console.log(`  ✓ Created: ${s.name} (${s.role})`)
      created++
    }
  }

  console.log(`\nCreated ${created} new staff, skipped ${skipped} (already exist)\n`)

  // ── 4. Appoint all Braco staff ─────────────────────────────────────────────
  const toAppoint = []

  // New staff
  for (const s of NEW_STAFF) {
    const pid = nameToId[s.name]
    if (!pid || alreadyAppointed.has(pid)) continue
    toAppoint.push({
      person_id: pid,
      site_id: BRACO_SITE_ID,
      role_on_job: s.role,
      is_manager: s.is_manager,
      appointed_by: APPOINTED_BY,
      start_date: START_DATE,
      end_date: null,
    })
  }

  // Existing matched staff
  for (const [diaryName, dbName] of Object.entries(EXISTING_MATCHES)) {
    const pid = nameToId[dbName]
    if (!pid) { console.log(`  WARN: could not find existing person "${dbName}"`); continue }
    if (alreadyAppointed.has(pid)) { console.log(`  SKIP (already appointed): ${dbName}`); continue }
    const person = (existing ?? []).find(p => p.name.trim().toLowerCase() === dbName.trim().toLowerCase())
    toAppoint.push({
      person_id: pid,
      site_id: BRACO_SITE_ID,
      role_on_job: person?.role ?? diaryName,
      is_manager: ['Stuart Paterson', 'Andrew McInnes'].includes(dbName) ? false : undefined,
      appointed_by: APPOINTED_BY,
      start_date: START_DATE,
      end_date: null,
    })
  }

  if (toAppoint.length > 0) {
    const { error } = await sb.from('job_appointments').insert(toAppoint)
    if (error) console.error('Appointment insert error:', error.message)
    else console.log(`✓ Appointed ${toAppoint.length} people to Braco`)
  } else {
    console.log('No new appointments needed')
  }

  // ── 5. Set up diary name mappings ──────────────────────────────────────────
  console.log('\nSetting up diary name mappings...')
  let mappingCount = 0
  for (const alias of DIARY_NAME_ALIASES) {
    const pid = nameToId[alias.canonical]
    if (!pid) { console.log(`  WARN: no person_id for canonical "${alias.canonical}"`); continue }

    const { error } = await sb.from('diary_name_mappings').upsert({
      site_id: BRACO_SITE_ID,
      raw_name: alias.raw,
      person_id: pid,
    }, { onConflict: 'site_id,raw_name' })

    if (error) console.error(`  ERROR mapping "${alias.raw}": ${error.message}`)
    else { console.log(`  ✓ ${alias.raw} → ${alias.canonical}`); mappingCount++ }
  }

  // Also add direct mappings for all new staff (raw_name = their name as it appears in diaries)
  const directMappings = NEW_STAFF.map(s => ({ raw_name: s.name, person_id: nameToId[s.name] }))
    .filter(m => m.person_id && !DIARY_NAME_ALIASES.find(a => a.raw === m.raw_name))

  for (const m of directMappings) {
    const { error } = await sb.from('diary_name_mappings').upsert({
      site_id: BRACO_SITE_ID,
      raw_name: m.raw_name,
      person_id: m.person_id,
    }, { onConflict: 'site_id,raw_name' })
    if (!error) mappingCount++
  }

  // Existing staff direct mappings
  for (const [diaryName, dbName] of Object.entries(EXISTING_MATCHES)) {
    const pid = nameToId[dbName]
    if (!pid) continue
    const { error } = await sb.from('diary_name_mappings').upsert({
      site_id: BRACO_SITE_ID,
      raw_name: diaryName,
      person_id: pid,
    }, { onConflict: 'site_id,raw_name' })
    if (!error) mappingCount++
  }

  console.log(`✓ ${mappingCount} diary name mappings set\n`)
  console.log('Done — Braco team fully set up.')
}

run().catch(console.error)
