import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://ofsvphmnutdwtawhdzge.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const SITE = '00000000-0000-0000-0000-000000000001'
const DATE = '2026-07-01'

// â”€â”€ Helper: get cable IDs by refs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function getCableIds(refs) {
  const { data, error } = await sb.from('cable_items')
    .select('id, cable_ref').eq('site_id', SITE).in('cable_ref', refs)
  if (error) { console.error('getCableIds:', error.message); process.exit(1) }
  return Object.fromEntries(data.map(r => [r.cable_ref, r.id]))
}

// â”€â”€ Helper: mark activities complete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function markComplete(cableId, activity, end_side) {
  const key = `${activity}|${end_side ?? ''}`
  const { error } = await sb.from('cable_activities')
    .update({ status: 'Complete', completed_by: 'Site team', completed_at: new Date(DATE).toISOString() })
    .eq('cable_id', cableId).eq('activity', activity)
    .is(end_side ? 'end_side' : 'end_side', end_side ?? null)
  if (error) console.warn(`  warn ${key}:`, error.message)
  else process.stdout.write('.')
}

async function markActivities(refs, activities) {
  const idMap = await getCableIds(refs)
  for (const ref of refs) {
    const cableId = idMap[ref]
    if (!cableId) { console.warn(`  Cable not found: ${ref}`); continue }
    for (const [activity, end_side] of activities) {
      await markComplete(cableId, activity, end_side)
    }
    // Recompute completion_pct
    const { data: acts } = await sb.from('cable_activities').select('status').eq('cable_id', cableId)
    if (acts) {
      const pct = acts.filter(a => a.status === 'Complete').length / acts.length
      const status = pct >= 1 ? 'Complete' : pct > 0 ? 'In Progress' : 'Not Started'
      await sb.from('cable_items').update({ completion_pct: pct, overall_status: status }).eq('id', cableId)
    }
  }
}

// â”€â”€ MVS-1: P202-1 to P205-1 â€” ran in and dressed (no tracked activity yet, add note)
// Pull not currently a tracked activity for AC Battery, so flag these as in-progress with notes
async function flagCables(refs, note) {
  const idMap = await getCableIds(refs)
  for (const ref of refs) {
    const id = idMap[ref]
    if (!id) { console.warn(`  Not found: ${ref}`); continue }
    await sb.from('cable_items').update({ notes: note, overall_status: 'In Progress', completion_pct: 0.05 }).eq('id', id)
    process.stdout.write('.')
  }
}

// â”€â”€ Run all updates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

console.log('\nâ”€â”€ MVS-1 P202-1 to P205-1: ran in and dressed')
await flagCables(['P202-1','P203-1','P204-1','P205-1'], 'Ran in and dressed 01/07/26. Ready for glanding.')

console.log('\nâ”€â”€ MVS-1 P201-1 (5C 70mm): glanded both ends')
await markActivities(['P201-1'], [['Gland','MVS side'],['Gland','Skid side']])

console.log('\nâ”€â”€ MVS-2 P202-2 to P205-2: all glanded both ends')
await markActivities(['P202-2','P203-2','P204-2','P205-2'], [['Gland','Transformer side'],['Gland','Battery side']])
// P202-2 and P203-2 waiting for crimps â€” add note
const waitCrimps = await getCableIds(['P202-2','P203-2'])
for (const id of Object.values(waitCrimps)) {
  await sb.from('cable_items').update({ notes: 'Waiting for crimps 01/07/26' }).eq('id', id)
}

console.log('\nâ”€â”€ MVS-2 P201-2 (5C 70mm): glanded')
await markActivities(['P201-2'], [['Gland','MVS side'],['Gland','Skid side']])

console.log('\nâ”€â”€ MVS-4 P202-4 to P205-4: ran in + gland battery side only')
await markActivities(['P202-4','P203-4','P204-4','P205-4'], [['Gland','Battery side']])
await flagCables(['P202-4','P203-4','P204-4','P205-4'], 'Ran in, dressed, crimped battery side 01/07/26. Waiting crimps TX side.')

console.log('\nâ”€â”€ MVS-4 P201-4 (5C 70mm): glanded')
await markActivities(['P201-4'], [['Gland','MVS side'],['Gland','Skid side']])

console.log('\nâ”€â”€ MVS-5 P202-5 to P205-5: ran in + gland battery side only')
await markActivities(['P202-5','P203-5','P204-5','P205-5'], [['Gland','Battery side']])
await flagCables(['P202-5','P203-5','P204-5','P205-5'], 'Ran in, dressed, crimped battery side 01/07/26. Waiting crimps TX side.')

console.log('\nâ”€â”€ MVS-5 P201-5 (5C 70mm): glanded')
await markActivities(['P201-5'], [['Gland','MVS side'],['Gland','Skid side']])

console.log('\nâ”€â”€ MVS-6 P202-6 to P205-6: gland battery side + crimp + test')
await markActivities(['P202-6','P203-6','P204-6','P205-6'], [
  ['Gland','Battery side'],['Crimp', null],['Test', null]
])

console.log('\nâ”€â”€ LV P200-1L1 to P200-3N: pull + gland + terminate (waiting test)')
const lvMains = [
  'P200-1L1','P200-1L2','P200-1L3','P200-1N',
  'P200-2L1','P200-2L2','P200-2L3','P200-2N',
  'P200-3L1','P200-3L2','P200-3L3','P200-3N',
]
await markActivities(lvMains, [['Pull',null],['Gland',null],['Terminate',null]])
// Add note: bolted hand tight, waiting test
const lvIds = await getCableIds(lvMains)
for (const id of Object.values(lvIds)) {
  await sb.from('cable_items').update({ notes: 'Crimped & bolted hand tight onto bars 01/07/26. Waiting test.' }).eq('id', id)
}

console.log('\nâ”€â”€ LV P200-E: pulled and dressed')
const eIds = await getCableIds(['P200-E'])
if (eIds['P200-E']) {
  await sb.from('cable_items').update({ notes: 'Pulled and dressed 01/07/26', overall_status: 'In Progress', completion_pct: 0.2 }).eq('id', eIds['P200-E'])
  await markActivities(['P200-E'], [['Pull',null]])
}

// â”€â”€ Insert daily log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
console.log('\nâ”€â”€ Inserting daily log for 01/07/26')

const personnel = [
  { name: 'Gordon Reid',    role: 'Electrician', company: 'IPE', hours: 10 },
  { name: 'Rajeev Raj',     role: 'Electrician', company: 'IPE', hours: 10 },
  { name: 'Owen Gardner',   role: 'Electrician', company: 'IPE', hours: 10 },
  { name: 'Lewis Baillie',  role: 'Electrician', company: 'IPE', hours: 7.5,  note: 'Left early 15:00 â€” family reasons' },
  { name: 'Owen Lean',      role: 'Electrician', company: 'IPE', hours: 10,   note: 'Relocated to Rothie ~12:00' },
  { name: 'Calvin Wilson',  role: 'Electrician', company: 'IPE', hours: 10 },
  { name: 'Marc Speight',   role: 'Electrician', company: 'IPE', hours: 10 },
  { name: 'Adam Monaghue', role: 'Apprentice',  company: 'IPE', hours: 8.5,  note: 'Left early 16:00' },
  { name: 'Dylan Moran',    role: 'Apprentice',  company: 'IPE', hours: 10,   note: 'Relocated to Rothie ~12:00 with Owen Lean' },
]

const issues = [
  { description: 'Lewis Baillie left early at 15:00 due to family reasons', impact: 'Low', status: 'Closed' },
  { description: 'Adam Monaghue left early at 16:00', impact: 'Low', status: 'Closed' },
  { description: 'Owen Lean + Dylan Moran relocated to Rothie at 12:00', impact: 'Low', status: 'Closed' },
  { description: 'Crimp stock â€” P202-2, P203-2, P202-4 to P205-4, P202-5 to P205-5 all waiting for crimps (TX side)', impact: 'Medium', status: 'Open', action: 'Order/source crimps urgently' },
  { description: 'Water under LV switchroom floor â€” being pumped to sump', impact: 'Low', status: 'Open', action: 'Monitor and continue pumping' },
]

const totalManhours = personnel.reduce((s, p) => s + p.hours, 0)

const { error: logError } = await sb.from('site_daily_logs').upsert({
  site_id: SITE,
  log_date: DATE,
  personnel,
  total_manhours: totalManhours,
  weather_description: 'Dry, overcast, warm day',
  weather_conditions: 'Good',
  weather_lost_hours: 0,
  weather_impact: 'None',
  issues,
  summary: 'Progress across MVS-1 to MVS-6 and LV power. 13Ã— P200 series cables crimped and bolted onto bars ready for test. Crimp stock shortage blocking TX-side terminations on MVS-4 and MVS-5. Water under LV switchroom â€” pumping ongoing. 900mm ladder rack bracket fabrication started.',
  source: 'email',
  raw_email_body: `Daily report 01/07/26 â€” Dry, overcast, warm. MVS-1: P202-1 to P205-1 ran in and dressed. P201-1 glanded. MVS-2: P202-2 to P205-2 all glanded (P202-2/P203-2 waiting crimps). P201-2 glanded. MVS-4: P202-4 to P205-4 ran in, dressed, crimped battery side. P201-4 glanded. MVS-5: P202-5 to P205-5 ran in, dressed, crimped battery side. P201-5 glanded. MVS-6: P202-6 to P205-6 glanded battery side, crimped and tested. P200-1L1 to P200-3N all crimped and bolted hand tight onto bars waiting test. P200-E pulled and dressed. Marc Speight bolted down UPS cabinet, transformer, UPS1/2, LV switchboard. Fabricating 900mm ladder rack brackets.`,
}, { onConflict: 'site_id,log_date' })

if (logError) console.error('Daily log error:', logError.message)
else console.log(`  Daily log inserted â€” ${totalManhours} total manhours, ${personnel.length} personnel`)

console.log('\nDone!')


