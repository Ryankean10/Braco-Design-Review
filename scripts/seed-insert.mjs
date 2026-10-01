import { createClient } from '@supabase/supabase-js'
import { createRequire } from 'module'
import { randomUUID } from 'crypto'
const require = createRequire(import.meta.url)
const xlsx = require('xlsx')

const supabase = createClient(
  'https://ofsvphmnutdwtawhdzge.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const SITE = '00000000-0000-0000-0000-000000000001'
const PKG = {
  AC:    '00000000-0000-0000-0000-000000000010',
  C5:    '00000000-0000-0000-0000-000000000011',
  FIBRE: '00000000-0000-0000-0000-000000000012',
  COMMS: '00000000-0000-0000-0000-000000000013',
  HV:    '00000000-0000-0000-0000-000000000014',
}

const ACT_DEFS = {
  'AC Battery Cable': [
    { activity: 'Gland',     end_side: 'Transformer side', col: 'Gland' },
    { activity: 'Gland',     end_side: 'Battery side',     col: 'Gland' },
    { activity: 'Crimp',     end_side: null,               col: 'Crimp' },
    { activity: 'Terminate', end_side: null,               col: 'Terminate' },
    { activity: 'Test',      end_side: null,               col: 'Test' },
    { activity: 'Torque',    end_side: null,               col: 'Torque' },
  ],
  '5C 70mm2 Skid Cable': [
    { activity: 'Pulled',    end_side: null,       col: 'Gland' },
    { activity: 'Gland',     end_side: 'MVS side', col: 'Gland' },
    { activity: 'Gland',     end_side: 'Skid side',col: 'Gland' },
    { activity: 'Terminate', end_side: null,        col: 'Terminate' },
    { activity: 'Test',      end_side: null,        col: 'Test' },
  ],
  'Fibre Cable': [
    { activity: 'Fibre Pulled',     end_side: null, col: 'Gland' },
    { activity: 'Fibre Terminated', end_side: null, col: 'Terminate' },
    { activity: 'Fibre Tested',     end_side: null, col: 'Test' },
  ],
  'Comms / Multicore': [
    { activity: 'Pulled',    end_side: null, col: null },
    { activity: 'Gland',     end_side: null, col: null },
    { activity: 'Terminate', end_side: null, col: null },
    { activity: 'Test',      end_side: null, col: null },
    { activity: 'Label',     end_side: null, col: null },
  ],
}

const PKG_KEY_MAP = {
  'AC Battery Cable':    { pkgId: PKG.AC,    name: 'AC Battery Cable',    defKey: 'AC Battery Cable' },
  '5C 70mm2 Skid Cable': { pkgId: PKG.C5,    name: '5C 70mmÂ² Skid Cable', defKey: '5C 70mm2 Skid Cable' },
  'Fibre Cable':         { pkgId: PKG.FIBRE, name: 'Fibre Cable',         defKey: 'Fibre Cable' },
}

async function upsert(table, rows) {
  const { error } = await supabase.from(table).upsert(rows, { ignoreDuplicates: true })
  if (error) { console.error(`Upsert ${table}:`, error.message); process.exit(1) }
}

async function insertChunked(table, rows, size = 150) {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + size))
    if (error && !error.message.includes('duplicate') && !error.message.includes('unique')) {
      console.error(`Insert ${table} row ~${i}:`, error.message)
      process.exit(1)
    }
    process.stdout.write('.')
  }
  console.log(` done (${rows.length})`)
}

// â”€â”€ Site + Packages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
process.stdout.write('Site... ')
await upsert('construction_sites', [{
  id: SITE, name: 'Dyce BESS', client: 'Centrica',
  location: 'Dyce, Aberdeen', voltage_kv: 33, status: 'active', start_date: '2026-06-01'
}])
console.log('ok')

process.stdout.write('Packages... ')
await upsert('construction_packages', [
  { id: PKG.AC,    site_id: SITE, name: 'AC Battery Cable',    package_type: 'cable', sort_order: 1 },
  { id: PKG.C5,    site_id: SITE, name: '5C 70mmÂ² Skid Cable', package_type: 'cable', sort_order: 2 },
  { id: PKG.FIBRE, site_id: SITE, name: 'Fibre Cable',         package_type: 'cable', sort_order: 3 },
  { id: PKG.COMMS, site_id: SITE, name: 'Comms / Multicore',   package_type: 'cable', sort_order: 4 },
  { id: PKG.HV,    site_id: SITE, name: '33kV HV Cable',       package_type: 'cable', sort_order: 5 },
])
console.log('ok')

// â”€â”€ Cable register (XLSX) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const wb = xlsx.readFile('C:/Users/admin/Downloads/DYCE_Site_Progress_Tracker (1).xlsx')
const raw = xlsx.utils.sheet_to_json(wb.Sheets['Cable_Register'], { defval: '' })

const cableRows = []
const actRows   = []

for (const r of raw) {
  const pkgInfo = PKG_KEY_MAP[r['Package']]
  if (!pkgInfo) continue
  const cableRef = String(r['Cable ID'] || '').trim()
  if (!cableRef) continue

  const acts = ACT_DEFS[pkgInfo.defKey] ?? []
  const done = acts.filter(a => a.col && String(r[a.col] || '').toLowerCase() === 'yes').length
  const pct  = acts.length ? done / acts.length : 0
  const cableId = randomUUID()

  cableRows.push({
    id: cableId, site_id: SITE,
    package_id: pkgInfo.pkgId, package_name: pkgInfo.name,
    cable_ref: cableRef,
    from_unit: String(r['From'] || '').trim() || null,
    to_unit:   String(r['To']   || '').trim() || null,
    cable_size: String(r['Cable Size'] || '').trim() || null,
    length_m:  parseFloat(r['Length m']) || null,
    mvs:       String(r['MVS']     || '').trim() || null,
    battery:   String(r['Battery'] || '').trim() || null,
    completion_pct: pct,
    overall_status: pct >= 1 ? 'Complete' : pct > 0 ? 'In Progress' : 'Not Started',
    source: 'xlsx',
    notes: String(r['Notes'] || '').trim() || null,
  })

  for (const act of acts) {
    const done = act.col ? String(r[act.col] || '').toLowerCase() === 'yes' : false
    actRows.push({
      id: randomUUID(), cable_id: cableId, site_id: SITE,
      activity: act.activity, end_side: act.end_side,
      status: done ? 'Complete' : 'Not Started',
      source: 'xlsx',
    })
  }
}

// â”€â”€ Comms cables (ODS) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ods = xlsx.readFile('C:/Users/admin/Downloads/IPE-22316-EXL-SCH-0005 - COMMS CABLE SCHEDULE.ods')
const wsComms = ods.Sheets['SITE_LEVEL_-_COMMS__CABLES']
const commRaw = xlsx.utils.sheet_to_json(wsComms, { defval: '', header: 1 })
const hdrIdx  = commRaw.findIndex(r => r.some(c => String(c).includes('Cable Number')))
const commCables = commRaw.slice(hdrIdx + 1).filter(r => r[12] && String(r[12]).trim().startsWith('L'))

for (const r of commCables) {
  const cableRef = String(r[12]).trim()
  const cableId  = randomUUID()
  cableRows.push({
    id: cableId, site_id: SITE,
    package_id: PKG.COMMS, package_name: 'Comms / Multicore',
    cable_ref: cableRef,
    from_unit: String(r[13] || '').trim() || null,
    to_unit:   String(r[14] || '').trim() || null,
    cable_size: String(r[16] || '').trim() || null,
    length_m:  parseFloat(r[17]) || null,
    completion_pct: 0, overall_status: 'Not Started', source: 'ods',
  })
  for (const act of ACT_DEFS['Comms / Multicore']) {
    actRows.push({
      id: randomUUID(), cable_id: cableId, site_id: SITE,
      activity: act.activity, end_side: act.end_side,
      status: 'Not Started', source: 'ods',
    })
  }
}

console.log(`Cables: ${cableRows.length}, Activities: ${actRows.length}`)

process.stdout.write('Inserting cables ')
await insertChunked('cable_items', cableRows, 100)

process.stdout.write('Inserting activities ')
await insertChunked('cable_activities', actRows, 200)

console.log('Seed complete!')


