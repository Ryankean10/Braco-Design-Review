import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const sb = createClient(
  'https://ofsvphmnutdwtawhdzge.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const SITE   = '00000000-0000-0000-0000-000000000001'
const PKG_LV = '00000000-0000-0000-0000-000000000015'

// Activities for LV Power cables
const ACT_LV = [
  { activity: 'Pull',      end_side: null },
  { activity: 'Gland',     end_side: null },
  { activity: 'Terminate', end_side: null },
  { activity: 'Test',      end_side: null },
  { activity: 'Label',     end_side: null },
]

// Extracted from IPE-22316-EXL-SCH-0004 C02 LV POWER CABLE SCHEDULE
// scope: IPE = our install, ENVICO = Envico supply & fit, CPS = CPS supply
const LV_CABLES = [
  // â”€â”€ Aux Transformer â†’ Main LV Switchboard (13 single-core runs)
  { ref:'P200-1L1', from:'AUXILIARY POWER TRANSFORMER', to:'MAIN LV SWITCHBOARD', size:'500mmÂ²', cores:1, len:21, type:'BS6724 LSZH SWA XLPE Cu Armoured 600/1000V', scope:'IPE', notes:'L1 LVAC main feed' },
  { ref:'P200-1L2', from:'AUXILIARY POWER TRANSFORMER', to:'MAIN LV SWITCHBOARD', size:'500mmÂ²', cores:1, len:21, type:'BS6724 LSZH SWA XLPE Cu Armoured 600/1000V', scope:'IPE', notes:'L2 LVAC main feed' },
  { ref:'P200-1L3', from:'AUXILIARY POWER TRANSFORMER', to:'MAIN LV SWITCHBOARD', size:'500mmÂ²', cores:1, len:21, type:'BS6724 LSZH SWA XLPE Cu Armoured 600/1000V', scope:'IPE', notes:'L3 LVAC main feed' },
  { ref:'P200-1N',  from:'AUXILIARY POWER TRANSFORMER', to:'MAIN LV SWITCHBOARD', size:'500mmÂ²', cores:1, len:21, type:'BS6724 LSZH SWA XLPE Cu Armoured 600/1000V', scope:'IPE', notes:'N LVAC main feed' },
  { ref:'P200-2L1', from:'AUXILIARY POWER TRANSFORMER', to:'MAIN LV SWITCHBOARD', size:'500mmÂ²', cores:1, len:21, type:'BS6724 LSZH SWA XLPE Cu Armoured 600/1000V', scope:'IPE', notes:'L1 LVAC main feed' },
  { ref:'P200-2L2', from:'AUXILIARY POWER TRANSFORMER', to:'MAIN LV SWITCHBOARD', size:'500mmÂ²', cores:1, len:21, type:'BS6724 LSZH SWA XLPE Cu Armoured 600/1000V', scope:'IPE', notes:'L2 LVAC main feed' },
  { ref:'P200-2L3', from:'AUXILIARY POWER TRANSFORMER', to:'MAIN LV SWITCHBOARD', size:'500mmÂ²', cores:1, len:21, type:'BS6724 LSZH SWA XLPE Cu Armoured 600/1000V', scope:'IPE', notes:'L3 LVAC main feed' },
  { ref:'P200-2N',  from:'AUXILIARY POWER TRANSFORMER', to:'MAIN LV SWITCHBOARD', size:'500mmÂ²', cores:1, len:21, type:'BS6724 LSZH SWA XLPE Cu Armoured 600/1000V', scope:'IPE', notes:'N LVAC main feed' },
  { ref:'P200-3L1', from:'AUXILIARY POWER TRANSFORMER', to:'MAIN LV SWITCHBOARD', size:'500mmÂ²', cores:1, len:21, type:'BS6724 LSZH SWA XLPE Cu Armoured 600/1000V', scope:'IPE', notes:'L1 LVAC main feed' },
  { ref:'P200-3L2', from:'AUXILIARY POWER TRANSFORMER', to:'MAIN LV SWITCHBOARD', size:'500mmÂ²', cores:1, len:21, type:'BS6724 LSZH SWA XLPE Cu Armoured 600/1000V', scope:'IPE', notes:'L2 LVAC main feed' },
  { ref:'P200-3L3', from:'AUXILIARY POWER TRANSFORMER', to:'MAIN LV SWITCHBOARD', size:'500mmÂ²', cores:1, len:21, type:'BS6724 LSZH SWA XLPE Cu Armoured 600/1000V', scope:'IPE', notes:'L3 LVAC main feed' },
  { ref:'P200-3N',  from:'AUXILIARY POWER TRANSFORMER', to:'MAIN LV SWITCHBOARD', size:'500mmÂ²', cores:1, len:21, type:'BS6724 LSZH SWA XLPE Cu Armoured 600/1000V', scope:'IPE', notes:'N LVAC main feed' },
  { ref:'P200-E',   from:'AUXILIARY POWER TRANSFORMER', to:'MAIN LV SWITCHBOARD', size:'300mmÂ²', cores:1, len:21, type:'BS6724 LSZH SWA XLPE Cu Armoured 600/1000V', scope:'IPE', notes:'Earth LVAC main feed' },

  // â”€â”€ Main LV Switchboard outgoing
  { ref:'P254', from:'MAIN LV SWITCHBOARD', to:'LVAC DIST BOARD',            size:'35mmÂ²',  cores:5, len:11, type:'N2XH Mains Non-Armoured LSZH',              scope:'IPE', notes:'Q13A LVAC Dist Board main feed' },
  { ref:'P255', from:'MAIN LV SWITCHBOARD', to:'EMERGENCY CHANGE-OVER SWITCH', size:'35mmÂ²', cores:5, len:11, type:'N2XH Mains Non-Armoured LSZH',             scope:'IPE', notes:'Q12A Emergency dist board main feed' },
  { ref:'P211', from:'MAIN LV SWITCHBOARD', to:'IDNO SUBSTATION LVDB',       size:'50mmÂ²',  cores:5, len:75, type:'BS6724 LSZH SWA XLPE Armoured 600/1000V',  scope:'IPE', notes:'Q9A IDNO sub LVDB supply' },
  { ref:'P212', from:'MAIN LV SWITCHBOARD', to:'MV SUB LV DB',               size:'16mmÂ²',  cores:5, len:45, type:'BS6724 LSZH SWA XLPE Armoured 600/1000V',  scope:'IPE', notes:'Q1A MV sub LV DB supply' },
  { ref:'P223', from:'MAIN LV SWITCHBOARD', to:'MV SUB BATTERY CHARGER 1',   size:'16mmÂ²',  cores:3, len:50, type:'BS6724 LSZH SWA XLPE Armoured 600/1000V',  scope:'IPE', notes:'Q10A MV sub battery charger 1' },
  { ref:'P224', from:'MAIN LV SWITCHBOARD', to:'MV SUB BATTERY CHARGER 2',   size:'16mmÂ²',  cores:3, len:50, type:'BS6724 LSZH SWA XLPE Armoured 600/1000V',  scope:'IPE', notes:'Q11A MV sub battery charger 2' },

  // â”€â”€ LVAC Dist Board outgoing
  { ref:'P215', from:'LVAC DIST BOARD', to:'EV CHARGER (22kW)',              size:'25mmÂ²',  cores:3, len:60, type:'BS6724 LSZH SWA XLPE Armoured 600/1000V',  scope:'IPE', notes:'Q6B EV charger supply' },
  { ref:'P224b',from:'LVAC DIST BOARD', to:'LV SUB SOCKETS RING',           size:null,     cores:3, len:15, type:null,                                         scope:'IPE', notes:'Q3B LV sub sockets ring' },
  { ref:'P232', from:'LVAC DIST BOARD', to:'COMMS ISOLATOR SWITCH 1',        size:'2.5mmÂ²', cores:3, len:15, type:'N2XH Mains Non-Armoured LSZH',              scope:'IPE', notes:'Q7B comms isolator 1 â€” Centrica to supply final cable from secondary to comms rack' },
  { ref:'P233', from:'LVAC DIST BOARD', to:'COMMS ISOLATOR SWITCH 2',        size:'2.5mmÂ²', cores:3, len:15, type:'N2XH Mains Non-Armoured LSZH',              scope:'IPE', notes:'Q8B comms isolator 2 â€” Centrica to supply final cable from secondary to comms rack' },
  { ref:'P216', from:'LVAC DIST BOARD', to:'LV SUBSTATION INTERNAL LIGHTING',size:null,     cores:null, len:10, type:null,                                     scope:'ENVICO', notes:'Q4C â€” Envico to supply cable' },
  { ref:'P221', from:'LVAC DIST BOARD', to:'LV SUBSTATION HVAC 1',           size:null,     cores:3, len:12, type:null,                                         scope:'ENVICO', notes:'Q1B â€” Envico to supply cable' },
  { ref:'P258', from:'LVAC DIST BOARD', to:'LV SUBSTATION HVAC 2',           size:null,     cores:3, len:19, type:null,                                         scope:'ENVICO', notes:'Q2B â€” Envico to supply cable' },
  { ref:'P240', from:'LVAC DIST BOARD', to:'SCADA PANEL',                    size:null,     cores:3, len:12, type:null,                                         scope:'ENVICO', notes:'Q2D â€” Envico to supply cable' },
  { ref:'P262', from:'LVAC DIST BOARD', to:'LV SUBSTATION EXTERNAL LIGHTING',size:null,     cores:null, len:10, type:null,                                     scope:'ENVICO', notes:'Q5C â€” Envico to supply cable' },

  // â”€â”€ Emergency DB / Changeover
  { ref:'P217', from:'EMERGENCY DISTRIBUTION BOARD', to:'OUTDOOR LIGHTING PANEL', size:'2.5mmÂ²', cores:3, len:12, type:'N2XH Mains Non-Armoured LSZH',        scope:'IPE',    notes:'Q4C outdoor lighting' },
  { ref:'P220', from:'EMERGENCY DISTRIBUTION BOARD', to:'UPS EXTERNAL BYPASS SWITCH', size:'10mmÂ²', cores:3, len:10, type:'N2XH Mains Non-Armoured LSZH',    scope:'IPE',    notes:'Q1C UPS system mains input' },
  { ref:'P252', from:'EMERGENCY CHANGE-OVER SWITCH', to:'GENERATOR SOCKET',     size:null, cores:5, len:25, type:null,                                         scope:'ENVICO', notes:'Envico to supply cable â€” generator back-up' },
  { ref:'P259', from:'EMERGENCY CHANGE-OVER SWITCH', to:'EMERGENCY DISTRIBUTION BOARD', size:null, cores:null, len:4, type:null,                              scope:'ENVICO', notes:'Envico to supply cable' },

  // â”€â”€ UPS system
  { ref:'P218', from:'UPS EXTERNAL BYPASS SWITCH', to:'UPS 1',               size:'10mmÂ²', cores:3, len:10, type:'230V AC 3core HO5BN4-F (6381TQ)',           scope:'IPE', notes:'UPS 1 input' },
  { ref:'P219', from:'UPS EXTERNAL BYPASS SWITCH', to:'UPS 2',               size:'10mmÂ²', cores:3, len:10, type:'230V AC 3core HO5BN4-F (6381TQ)',           scope:'IPE', notes:'UPS 2 input' },
  { ref:'P225', from:'UPS 1',                       to:'UPS PARALLEL BOX',   size:'10mmÂ²', cores:3, len:10, type:'Eland H07RN-F A5G0310',                     scope:'IPE', notes:'UPS 1 output' },
  { ref:'P226', from:'UPS 2',                       to:'UPS PARALLEL BOX',   size:'10mmÂ²', cores:3, len:10, type:'Eland H07RN-F A5G0310',                     scope:'IPE', notes:'UPS 2 output' },
  { ref:'P227', from:'UPS PARALLEL BOX',            to:'UPS EXTERNAL BYPASS SWITCH', size:'10mmÂ²', cores:3, len:10, type:'Eland H07RN-F A5G0310',             scope:'IPE', notes:'UPS common output' },
  { ref:'P237', from:'UPS EXTERNAL BYPASS SWITCH',  to:'UPS 1',              size:'10mmÂ²', cores:3, len:10, type:'Eland H07RN-F A5G0310',                     scope:'IPE', notes:'UPS 1 bypass output' },
  { ref:'P238', from:'UPS EXTERNAL BYPASS SWITCH',  to:'UPS 2',              size:'10mmÂ²', cores:3, len:10, type:'Eland H07RN-F A5G0310',                     scope:'IPE', notes:'UPS 2 bypass output' },
  { ref:'P256', from:'UPS EXTERNAL BYPASS SWITCH',  to:'UPS 230V TRANSFORMER', size:'10mmÂ²', cores:3, len:15, type:'N2XH Mains Non-Armoured LSZH',            scope:'IPE', notes:'UPS transformer primary' },
  { ref:'P239', from:'UPS 230V TRANSFORMER',        to:'UPS DIST BOARD',     size:'10mmÂ²', cores:3, len:15, type:'N2XH Mains Non-Armoured LSZH',              scope:'IPE', notes:'UPS transformer secondary' },
  { ref:'P235', from:'UPS BATTERY CABINET',         to:'UPS 1',              size:null,    cores:null, len:15, type:null,                                      scope:'CPS',    notes:'CPS to supply cable â€” UPS 1 battery charge/discharge DC' },
  { ref:'P236', from:'UPS BATTERY CABINET',         to:'UPS 2',              size:null,    cores:null, len:15, type:null,                                      scope:'CPS',    notes:'CPS to supply cable â€” UPS 2 battery charge/discharge DC' },

  // â”€â”€ UPS Dist Board outgoing
  { ref:'P241', from:'UPS DIST BOARD', to:'SCADA PANEL',                     size:'1.5mmÂ²', cores:3, len:12, type:'N2XH Mains Non-Armoured LSZH',             scope:'IPE', notes:'Q2D AC supply' },
  { ref:'P243', from:'UPS DIST BOARD', to:'INTRUSION DETECTION SYSTEM',      size:'1.5mmÂ²', cores:3, len:10, type:'N2XH Mains Non-Armoured LSZH',             scope:'IPE', notes:'Q3D AC supply' },
  { ref:'P244', from:'UPS DIST BOARD', to:'AUTOMATED ACCESS CONTROL SYSTEM', size:'1.5mmÂ²', cores:3, len:10, type:'N2XH Mains Non-Armoured LSZH',             scope:'IPE', notes:'Q4D AC supply' },
  { ref:'P245', from:'UPS DIST BOARD', to:'CCTV PANEL',                      size:'1.5mmÂ²', cores:3, len:15, type:'N2XH Mains Non-Armoured LSZH',             scope:'IPE', notes:'Q5D AC supply' },
  { ref:'P246', from:'UPS DIST BOARD', to:'FIRE PANEL LV SUB',               size:'1.5mmÂ²', cores:3, len:15, type:'N2XH Mains Non-Armoured LSZH',             scope:'IPE', notes:'Q6D fire panel LV feed 1' },
  { ref:'P247', from:'UPS DIST BOARD', to:'FIRE PANEL LV SUB',               size:'1.5mmÂ²', cores:3, len:15, type:'N2XH Mains Non-Armoured LSZH',             scope:'IPE', notes:'Q9D fire panel LV feed 2' },
  { ref:'P248', from:'UPS DIST BOARD', to:'FXT1',                             size:'1.5mmÂ²', cores:3, len:15, type:'N2XH Mains Non-Armoured LSZH',             scope:'IPE', notes:'Q7D AC supply' },
  { ref:'P257', from:'UPS DIST BOARD', to:'FXT2',                             size:'1.5mmÂ²', cores:3, len:15, type:'N2XH Mains Non-Armoured LSZH',             scope:'IPE', notes:'Q8D AC supply' },
  { ref:'P260', from:'UPS DIST BOARD', to:'G100 PANEL',                       size:'1.5mmÂ²', cores:3, len:10.5, type:'N2XH Mains Non-Armoured LSZH',           scope:'IPE', notes:'Q13D AC supply' },
  { ref:'P261', from:'UPS DIST BOARD', to:'SUBNET (FAULT RECORDER)',          size:'1.5mmÂ²', cores:3, len:10.5, type:'N2XH Mains Non-Armoured LSZH',           scope:'IPE', notes:'Q12D AC supply' },
  { ref:'P230', from:'UPS DIST BOARD', to:'EMS PANEL 2',                      size:'2.5mmÂ²', cores:3, len:15, type:'N2XH Mains Non-Armoured LSZH',             scope:'IPE', notes:'Q10D AC supply' },

  // â”€â”€ EMS inter-panel
  { ref:'P253', from:'EMS PANEL 2',   to:'EMS PANEL 1',                      size:'2.5mmÂ²', cores:3, len:10, type:'N2XH Mains Non-Armoured LSZH',             scope:'IPE', notes:'AC supply EMS panel 1 from panel 2' },
  { ref:'P231', from:'LVAC DIST BOARD', to:'EMS PANEL 2',                    size:'2.5mmÂ²', cores:3, len:15, type:'N2XH Mains Non-Armoured LSZH',             scope:'IPE', notes:'Duplicate route check â€” verify with design' },
]

async function insertChunked(table, rows, size = 100) {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await sb.from(table).insert(rows.slice(i, i + size))
    if (error && !error.message.includes('duplicate') && !error.message.includes('unique')) {
      console.error(`Insert ${table} ~${i}:`, error.message)
      process.exit(1)
    }
    process.stdout.write('.')
  }
  console.log(` ${rows.length}`)
}

const cableRows = []
const actRows   = []

for (const c of LV_CABLES) {
  const cableId = randomUUID()
  cableRows.push({
    id: cableId, site_id: SITE,
    package_id: PKG_LV, package_name: 'LV Power',
    cable_ref: c.ref,
    from_unit: c.from,
    to_unit:   c.to,
    cable_size: c.size,
    num_cores:  c.cores,
    length_m:   c.len,
    cable_type_desc: c.type,
    scope:     c.scope,
    overall_status: 'Not Started',
    completion_pct: 0,
    source: 'pdf',
    notes: c.notes || null,
    flagged: c.scope !== 'IPE',
    flag_reason: c.scope !== 'IPE' ? `${c.scope} supplied â€” not IPE install scope` : null,
  })

  // Only create activities for IPE-scope cables
  if (c.scope === 'IPE') {
    for (const act of ACT_LV) {
      actRows.push({
        id: randomUUID(), cable_id: cableId, site_id: SITE,
        activity: act.activity, end_side: act.end_side,
        status: 'Not Started', source: 'pdf',
      })
    }
  }
}

process.stdout.write(`Inserting ${cableRows.length} LV Power cables `)
await insertChunked('cable_items', cableRows)

process.stdout.write(`Inserting ${actRows.length} activities `)
await insertChunked('cable_activities', actRows)

console.log('LV Power seed complete!')
console.log(`  IPE scope: ${cableRows.filter(c => !c.flagged).length} cables with activities`)
console.log(`  Non-IPE (flagged): ${cableRows.filter(c => c.flagged).length} cables`)


