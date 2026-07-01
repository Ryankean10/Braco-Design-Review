import { readFileSync, writeFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const xlsx = require('xlsx')

const SITE_UUID = '00000000-0000-0000-0000-000000000001'
const PKG_AC    = '00000000-0000-0000-0000-000000000010'
const PKG_5C70  = '00000000-0000-0000-0000-000000000011'
const PKG_FIBRE = '00000000-0000-0000-0000-000000000012'
const PKG_COMMS = '00000000-0000-0000-0000-000000000013'

const pkgMap = {
  'AC Battery Cable':    PKG_AC,
  '5C 70mm2 Skid Cable': PKG_5C70,
  'Fibre Cable':         PKG_FIBRE,
}

const activityDefs = {
  'AC Battery Cable': [
    { activity: 'Gland',     end_side: 'Transformer side' },
    { activity: 'Gland',     end_side: 'Battery side' },
    { activity: 'Crimp',     end_side: null },
    { activity: 'Terminate', end_side: null },
    { activity: 'Test',      end_side: null },
    { activity: 'Torque',    end_side: null },
  ],
  '5C 70mm2 Skid Cable': [
    { activity: 'Pulled',    end_side: null },
    { activity: 'Gland',     end_side: 'MVS side' },
    { activity: 'Gland',     end_side: 'Skid side' },
    { activity: 'Terminate', end_side: null },
    { activity: 'Test',      end_side: null },
  ],
  'Fibre Cable': [
    { activity: 'Fibre Pulled',     end_side: null },
    { activity: 'Fibre Terminated', end_side: null },
    { activity: 'Fibre Tested',     end_side: null },
  ],
}

function esc(v) {
  return String(v ?? '').replace(/'/g, "''")
}
function sqlStr(v) {
  const s = esc(v)
  return s ? `'${s}'` : 'null'
}

// ── Read cable register ──────────────────────────────────────────────────────
const wb = xlsx.readFile('C:/Users/admin/Downloads/DYCE_Site_Progress_Tracker (1).xlsx')
const cables = xlsx.utils.sheet_to_json(wb.Sheets['Cable_Register'], { defval: '' })

// ── Read comms ODS ────────────────────────────────────────────────────────────
const ods = xlsx.readFile('C:/Users/admin/Downloads/IPE-22316-EXL-SCH-0005 - COMMS CABLE SCHEDULE.ods')
const wsComms = ods.Sheets['SITE_LEVEL_-_COMMS__CABLES']
const commRaw = xlsx.utils.sheet_to_json(wsComms, { defval: '', header: 1 })
const hdrIdx = commRaw.findIndex(r => r.some(c => String(c).includes('Cable Number')))
const commCables = commRaw.slice(hdrIdx + 1).filter(r => r[12] && String(r[12]).trim().startsWith('L'))

// ── Build SQL ─────────────────────────────────────────────────────────────────
const parts = []

parts.push(`-- ── Dyce construction site ──────────────────────────────────────────────────
insert into public.construction_sites (id, name, client, location, capacity_mw, voltage_kv, status, start_date)
values (
  '${SITE_UUID}', 'Dyce BESS', 'Centrica', 'Dyce, Aberdeen',
  null, 33, 'active', '2026-06-01'
) on conflict (id) do nothing;`)

parts.push(`-- ── Packages ────────────────────────────────────────────────────────────────
insert into public.construction_packages (id, site_id, name, package_type, sort_order) values
  ('${PKG_AC}',    '${SITE_UUID}', 'AC Battery Cable',     'cable', 1),
  ('${PKG_5C70}',  '${SITE_UUID}', '5C 70mm² Skid Cable',  'cable', 2),
  ('${PKG_FIBRE}', '${SITE_UUID}', 'Fibre Cable',          'cable', 3),
  ('${PKG_COMMS}', '${SITE_UUID}', 'Comms / Multicore',    'cable', 4),
  ('00000000-0000-0000-0000-000000000014', '${SITE_UUID}', '33kV HV Cable', 'cable', 5)
on conflict (id) do nothing;`)

const cableRows = []
const actRows = []

cables.forEach((row, i) => {
  const pkgId = pkgMap[row.Package] || PKG_AC
  const id = `10000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`
  const ref = sqlStr(row['Cable ID'])
  const fromU = sqlStr(row['From'])
  const toU   = sqlStr(row['To'])
  const size  = sqlStr(row['Cable Size'])
  const len   = row['Length m'] !== '' ? row['Length m'] : 'null'
  const mvs   = sqlStr(row.MVS)
  const bat   = sqlStr(row.Battery)
  const pct   = Number(row['Cable %'] || 0).toFixed(4)
  const status = sqlStr(row['Overall Status'] || 'Not Started')
  const notes  = sqlStr(row.Notes)

  cableRows.push(
    `('${id}', '${SITE_UUID}', '${pkgId}', '${esc(row.Package)}', ${ref}, ${fromU}, ${toU}, ${size}, ${len}, ${mvs}, ${bat}, ${pct}, ${status}, ${notes})`
  )

  // Map Yes/No columns to activity statuses
  const done = {
    Gland:             row.Gland     === 'Yes',
    Crimp:             row.Crimp     === 'Yes',
    Terminate:         row.Terminate === 'Yes',
    Test:              row.Test      === 'Yes',
    Torque:            row.Torque    === 'Yes',
    Pulled:            row.Gland     === 'Yes',
    'Fibre Pulled':    row.Gland     === 'Yes',
    'Fibre Terminated':row.Crimp     === 'Yes',
    'Fibre Tested':    row.Terminate === 'Yes',
  }
  const defs = activityDefs[row.Package] || []
  defs.forEach((def, j) => {
    const actId = `20000000-${String(i + 1).padStart(8, '0')}-0000-0000-${String(j + 1).padStart(12, '0')}`
    const actSt = done[def.activity] ? 'Complete' : 'Not Started'
    const endSide = def.end_side ? `'${def.end_side}'` : 'null'
    actRows.push(
      `('${actId}', '${id}', '${SITE_UUID}', '${def.activity}', ${endSide}, '${actSt}')`
    )
  })
})

// Comms cables
commCables.forEach((row, i) => {
  const id = `30000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`
  const ref  = sqlStr(String(row[12]).trim())
  const fromU = sqlStr(String(row[0]).trim())
  const toU   = sqlStr(String(row[5]).trim())
  const size  = row[9] ? `'${row[9]}mm²'` : 'null'
  const len   = row[1] !== '' ? row[1] : 'null'
  const notes = sqlStr(String(row[17] || '').substring(0, 200))

  cableRows.push(
    `('${id}', '${SITE_UUID}', '${PKG_COMMS}', 'Comms / Multicore', ${ref}, ${fromU}, ${toU}, ${size}, ${len}, null, null, 0, 'Not Started', ${notes})`
  )
  ;['Pulled', 'Gland', 'Terminate', 'Test', 'Label'].forEach((act, j) => {
    const actId = `40000000-${String(i + 1).padStart(8, '0')}-0000-0000-${String(j + 1).padStart(12, '0')}`
    actRows.push(
      `('${actId}', '${id}', '${SITE_UUID}', '${act}', null, 'Not Started')`
    )
  })
})

parts.push(`-- ── Cable items (${cableRows.length} cables) ──────────────────────────────────
insert into public.cable_items
  (id, site_id, package_id, package_name, cable_ref, from_unit, to_unit,
   cable_size, length_m, mvs, battery, completion_pct, overall_status, notes)
values
${cableRows.join(',\n')}
on conflict (site_id, cable_ref) do nothing;`)

parts.push(`-- ── Cable activities (${actRows.length} rows) ──────────────────────────────────
insert into public.cable_activities
  (id, cable_id, site_id, activity, end_side, status)
values
${actRows.join(',\n')}
on conflict (cable_id, activity, coalesce(end_side, '')) do nothing;`)

writeFileSync('supabase/migrations/022b_dyce_seed.sql', parts.join('\n\n'))
console.log(`Written 022b_dyce_seed.sql — ${cableRows.length} cables, ${actRows.length} activities`)
