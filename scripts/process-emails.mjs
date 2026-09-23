/**
 * process-emails.mjs
 *
 * Usage:
 *   node scripts/process-emails.mjs <path-to-email-or-folder> [--dry-run]
 *
 * Examples:
 *   node scripts/process-emails.mjs "C:/Users/admin/Downloads/emails/"
 *   node scripts/process-emails.mjs "C:/Users/admin/Downloads/Cable progress 25_06_26.eml"
 *   node scripts/process-emails.mjs "C:/Users/admin/Downloads/emails/" --dry-run
 *
 * Reads .eml files, calls Claude to extract structured daily log data,
 * upserts into site_daily_logs and updates cable_activities.
 *
 * Env vars required:
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ANTHROPIC_API_KEY
 */

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

const DRY_RUN = process.argv.includes('--dry-run')
const INPUT = process.argv.slice(2).find(a => !a.startsWith('--'))

if (!INPUT) {
  console.error('Usage: node scripts/process-emails.mjs <path-to-email-or-folder> [--dry-run]')
  process.exit(1)
}

const sb = createClient(
  'https://ofsvphmnutdwtawhdzge.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SITE_ID = '00000000-0000-0000-0000-000000000001'

// ── Extract plain text from .eml ──────────────────────────────────────────────
function extractPlainText(emlPath) {
  const raw = readFileSync(emlPath, 'utf8')
  const match = raw.match(/Content-Type: text\/plain[^\r\n]*\r?\nContent-Transfer-Encoding: base64\r?\n\r?\n([\s\S]*?)(?:\r?\n--)/i)
  if (!match) {
    // Try plain text without encoding
    const plain = raw.match(/Content-Type: text\/plain[^\r\n]*\r?\n\r?\n([\s\S]*?)(?:\r?\n--)/i)
    return plain ? plain[1].trim() : null
  }
  const b64 = match[1].replace(/\s/g, '')
  return Buffer.from(b64, 'base64').toString('utf8')
}

function extractSubjectAndDate(emlPath) {
  const raw = readFileSync(emlPath, 'utf8')
  const subject = raw.match(/^Subject: (.+)/m)?.[1]?.trim() ?? ''
  const dateHeader = raw.match(/^Date: (.+)/m)?.[1]?.trim() ?? ''
  return { subject, dateHeader }
}

// ── Claude extraction prompt ───────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a construction data extractor for a BESS (Battery Energy Storage System) site in Dyce, Aberdeen.
Extract structured data from daily progress emails sent by the site construction manager (Stuart Paterson, OCU Group).

Cable reference conventions on this site:
- AC Battery cables: P202-x through P205-x (where x = MVS number 1-8)
- 5C 70mm² skid cables: P201-x (where x = MVS number)
- LV Power mains: P200-1L1, P200-1L2, P200-1L3, P200-1N, P200-2L1 etc.
- Fibre: F-prefix cables

Activity types tracked: Pull, Gland, Crimp, Terminate, Test, Torque, Label
End sides: "Transformer side" / "Battery side" / "MVS side" / "Skid side" / "Aux TX side"

When cables are described as "all tested" for an MVS, that means all P202-x through P205-x for that MVS number were tested.

Return ONLY valid JSON matching this schema exactly:
{
  "log_date": "YYYY-MM-DD",
  "weather_description": "string or null",
  "weather_conditions": "Good|Fair|Poor|null",
  "weather_lost_hours": number_or_0,
  "weather_impact": "None|Low|Medium|High",
  "personnel": [
    { "name": "string", "role": "Electrician|Apprentice|Site Manager|Engineer|Labourer|Other", "company": "IPE|OCU|Other", "hours": number, "note": "string or null" }
  ],
  "cable_updates": [
    { "cable_ref": "string", "activities_completed": ["Pull"|"Gland"|"Crimp"|"Terminate"|"Test"|"Torque"|"Label"], "end_side": "string or null", "notes": "string or null" }
  ],
  "issues": [
    { "description": "string", "impact": "Low|Medium|High|Critical", "status": "Open|Closed", "action": "string or null" }
  ],
  "summary": "string"
}

Notes:
- Estimate hours as 10 unless the email says someone left early or arrived late (deduct accordingly)
- Company is almost always "OCU" for Stuart's team unless stated otherwise
- If someone "left early at HH:MM" from a 07:00 start with a 10-hour day, calculate hours worked
- "All tested" for an MVS means Test activity for cables P202-x to P205-x (and P201-x)
- Multiple activities in one sentence ("pulled, glanded and crimped") = list all three
- If end_side is mentioned per activity, split into separate entries per cable_ref + end_side combination`

async function parseEmailWithClaude(emailText, subject, dateHeader) {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Subject: ${subject}\nDate header: ${dateHeader}\n\nEmail body:\n${emailText}`
    }]
  })

  const text = msg.content[0].text.trim()
  // Strip markdown code fences if present
  const json = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  return JSON.parse(json)
}

// ── Cable ref normalisation ────────────────────────────────────────────────────
// Emails use P201-x through P205-x; DB has P301-x through P305-x (+100 offset)
// Emails use P201-x for 5C skid cables; DB has 5C70-MVSx-01
function normaliseRef(ref) {
  // 5C skid cable: P201-x → 5C70-MVSx-01
  const skid = ref.match(/^P201-(\d+)$/)
  if (skid) return `5C70-MVS${skid[1]}-01`

  // AC Battery: P202-x through P205-x → P302-x through P305-x
  const ac = ref.match(/^P(20[2-5])-(\d+)$/)
  if (ac) return `P${parseInt(ac[1]) + 100}-${ac[2]}`

  // LV Power and others: no change
  return ref
}

// ── DB: resolve cable refs to IDs ─────────────────────────────────────────────
async function getCableIdMap(rawRefs) {
  if (!rawRefs.length) return {}
  const normMap = Object.fromEntries(rawRefs.map(r => [normaliseRef(r), r]))
  const normRefs = Object.keys(normMap)
  const { data, error } = await sb.from('cable_items')
    .select('id, cable_ref')
    .eq('site_id', SITE_ID)
    .in('cable_ref', normRefs)
  if (error) { console.error('getCableIdMap:', error.message); return {} }
  // Return map keyed by original (email) ref
  return Object.fromEntries(data.map(r => [normMap[r.cable_ref], r.id]))
}

// ── DB: apply cable activity updates ──────────────────────────────────────────
async function applyCableUpdates(cableUpdates, logDate) {
  if (!cableUpdates.length) return

  const refs = [...new Set(cableUpdates.map(u => u.cable_ref))]
  const idMap = await getCableIdMap(refs)

  let updated = 0
  let notFound = []

  for (const update of cableUpdates) {
    const cableId = idMap[update.cable_ref]
    if (!cableId) {
      notFound.push(update.cable_ref)
      continue
    }

    for (const activity of update.activities_completed) {
      const endSide = update.end_side ?? null
      const query = sb.from('cable_activities')
        .update({
          status: 'Complete',
          completed_by: 'Site team',
          completed_at: new Date(logDate).toISOString()
        })
        .eq('cable_id', cableId)
        .eq('activity', activity)
      const { error } = endSide
        ? await query.eq('end_side', endSide)
        : await query.is('end_side', null)
      if (error) console.warn(`  warn ${update.cable_ref}/${activity}:`, error.message)
      else updated++
    }

    if (update.notes) {
      await sb.from('cable_items')
        .update({ notes: update.notes, overall_status: 'In Progress' })
        .eq('id', cableId)
    }

    // Recompute completion_pct
    const { data: acts } = await sb.from('cable_activities').select('status').eq('cable_id', cableId)
    if (acts?.length) {
      const pct = acts.filter(a => a.status === 'Complete').length / acts.length
      const status = pct >= 1 ? 'Complete' : pct > 0 ? 'In Progress' : 'Not Started'
      await sb.from('cable_items').update({ completion_pct: pct, overall_status: status }).eq('id', cableId)
    }
  }

  console.log(`  Cable activities: ${updated} updated`)
  if (notFound.length) console.warn(`  Not found in DB: ${[...new Set(notFound)].join(', ')}`)
}

// ── DB: upsert daily log ───────────────────────────────────────────────────────
async function upsertDailyLog(parsed, rawEmailBody) {
  const totalManhours = parsed.personnel.reduce((s, p) => s + (p.hours ?? 10), 0)

  const { error } = await sb.from('site_daily_logs').upsert({
    site_id: SITE_ID,
    log_date: parsed.log_date,
    personnel: parsed.personnel,
    total_manhours: totalManhours,
    weather_description: parsed.weather_description,
    weather_conditions: parsed.weather_conditions,
    weather_lost_hours: parsed.weather_lost_hours ?? 0,
    weather_impact: parsed.weather_impact ?? 'None',
    issues: parsed.issues ?? [],
    summary: parsed.summary,
    source: 'email',
    raw_email_body: rawEmailBody,
  }, { onConflict: 'site_id,log_date' })

  if (error) console.error('  Daily log error:', error.message)
  else console.log(`  Daily log upserted — ${totalManhours} manhours, ${parsed.personnel.length} personnel`)
}

// ── Process a single .eml file ─────────────────────────────────────────────────
async function processEml(emlPath) {
  console.log(`\nProcessing: ${emlPath}`)

  const text = extractPlainText(emlPath)
  if (!text) { console.warn('  Could not extract plain text — skipping'); return }

  const { subject, dateHeader } = extractSubjectAndDate(emlPath)
  console.log(`  Subject: ${subject}`)

  let parsed
  try {
    parsed = await parseEmailWithClaude(text, subject, dateHeader)
  } catch (e) {
    console.error('  Claude parse error:', e.message)
    console.error('  Raw response may not be valid JSON — skipping')
    return
  }

  console.log(`  Date: ${parsed.log_date}`)
  console.log(`  Personnel: ${parsed.personnel.map(p => p.name).join(', ')}`)
  console.log(`  Cable updates: ${parsed.cable_updates.length} entries`)
  console.log(`  Issues: ${parsed.issues.length}`)

  if (DRY_RUN) {
    console.log('\n  [DRY RUN] Parsed data:')
    console.log(JSON.stringify(parsed, null, 2))
    return
  }

  await upsertDailyLog(parsed, text)
  await applyCableUpdates(parsed.cable_updates, parsed.log_date)
}

// ── Main ───────────────────────────────────────────────────────────────────────
const stat = statSync(INPUT)

let files = []
if (stat.isDirectory()) {
  files = readdirSync(INPUT)
    .filter(f => extname(f).toLowerCase() === '.eml')
    .map(f => join(INPUT, f))
    .sort()
} else {
  files = [INPUT]
}

console.log(`Found ${files.length} .eml file(s)${DRY_RUN ? ' [DRY RUN]' : ''}`)

for (const file of files) {
  await processEml(file)
}

console.log('\nDone!')
