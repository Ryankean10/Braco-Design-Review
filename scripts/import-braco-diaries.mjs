/**
 * Import Braco site diaries (53 x DOCX) into site_daily_logs
 * Run: node scripts/import-braco-diaries.mjs
 *
 * - Finds or creates the Braco construction site
 * - Reads each DOCX, strips XML tags, sends to Claude for structured extraction
 * - Upserts into site_daily_logs on (site_id, log_date)
 * - Reports unmatched personnel at end
 */
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, join, extname } from 'path'
import { execSync } from 'child_process'
import AdmZip from 'adm-zip'

// ── env ──────────────────────────────────────────────────────────────────────
const envLines = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')
const env = {}
for (const line of envLines) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '')
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

const DIARY_DIR = 'C:/Users/admin/Downloads/braco_diaries'

// ── helpers ──────────────────────────────────────────────────────────────────
function readDocxText(filePath) {
  const zip = new AdmZip(filePath)
  const entry = zip.getEntry('word/document.xml')
  if (!entry) return ''
  const xml = zip.readAsText(entry)
  return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
}

function walkDocx(dir) {
  const results = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) results.push(...walkDocx(full))
    else if (extname(name).toLowerCase() === '.docx') results.push(full)
  }
  return results.sort()
}

const SYSTEM_PROMPT = `You are a construction data extractor for a BESS site at Braco Substation, Perthshire, Scotland.
This is a civils-heavy site (groundworks, access road, drainage, foundations) at early stage — no electrical works yet.
Extract structured data from daily site diary documents written by the site agent (David Burns, OCU Group).

Personnel categories seen on this site:
- Workers (labourers/plant operators): Kyle Galloway, Lee McPhail, Jack Anderson, others
- Ganger: Graham McPhail
- Management: David Burns, Andy Turvey/Turver, Jim Barry
- Engineers: Max Ragsdale, Stewart Constantine, others
- Visitors: ecologists, client reps, DNO, etc

Return ONLY valid JSON (no markdown, no backticks):
{
  "log_date": "YYYY-MM-DD",
  "weather_description": "string",
  "weather_conditions": "Good|Fair|Poor",
  "weather_lost_hours": number,
  "weather_impact": "None|Low|Medium|High",
  "personnel": [
    { "name": "string", "role": "Worker|Ganger|Site Manager|Engineer|Visitor|Other", "company": "OCU|Other", "hours": number, "note": "string or null" }
  ],
  "civils_activities": [
    "brief description of each civils activity completed today"
  ],
  "plant_on_site": ["list of plant/equipment present"],
  "deliveries": ["list of materials delivered"],
  "issues": [
    { "description": "string", "impact": "Low|Medium|High|Critical", "status": "Open|Closed", "action": "string or null" }
  ],
  "summary": "1-2 sentence summary of the day's progress"
}

Rules:
- Estimate 10h per worker/ganger unless diary states otherwise
- Management/engineers: 10h unless stated
- Visitors: 4h unless stated
- weather_conditions: Good = dry/sunny, Fair = overcast/light rain, Poor = heavy rain/wind/snow
- If date is unclear from body, infer from filename hint provided
- civils_activities: extract specific activities (e.g. "Install 6F2 sub-base in CDM area", "Dig culvert no.1", "Lay silt fencing")
- issues: include delays, disputes, missing approvals, safety incidents`

async function extractDiary(text, fileNameHint) {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Filename hint: ${fileNameHint}\n\nDiary text:\n${text.slice(0, 6000)}` }]
  })
  const raw = msg.content[0].text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  return JSON.parse(raw)
}

// ── main ─────────────────────────────────────────────────────────────────────
async function run() {
  // Find or create Braco site
  let { data: site } = await supabase
    .from('construction_sites')
    .select('id, name')
    .ilike('name', '%braco%')
    .maybeSingle()

  if (!site) {
    const { data: inserted } = await supabase
      .from('construction_sites')
      .insert({
        name: 'Braco BESS',
        location: 'Braco Substation, Perthshire, Scotland',
        capacity_mw: 50,
        status: 'Under Construction',
        client: 'SP Energy Networks',
      })
      .select('id, name')
      .single()
    site = inserted
    console.log(`Created site: ${site.name} (${site.id})`)
  } else {
    console.log(`Found site: ${site.name} (${site.id})`)
  }

  const files = walkDocx(DIARY_DIR)
  console.log(`\nProcessing ${files.length} diary files...\n`)

  const allPersonnel = new Set()
  let success = 0, skipped = 0, errors = 0

  for (const filePath of files) {
    const fileName = filePath.split('/').pop()
    try {
      const text = readDocxText(filePath)
      if (!text || text.length < 50) {
        console.log(`  SKIP (empty): ${fileName}`)
        skipped++
        continue
      }

      const parsed = await extractDiary(text, fileName)

      if (!parsed.log_date || !parsed.log_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        console.log(`  SKIP (no date): ${fileName}`)
        skipped++
        continue
      }

      // Track all personnel names
      for (const p of parsed.personnel ?? []) {
        if (p.name) allPersonnel.add(p.name.trim())
      }

      const totalManhours = (parsed.personnel ?? []).reduce((s, p) => s + (p.hours ?? 10), 0)

      // Build issues array
      const issues = parsed.issues ?? []

      // Upsert daily log
      const { error } = await supabase.from('site_daily_logs').upsert({
        site_id: site.id,
        log_date: parsed.log_date,
        personnel: parsed.personnel ?? [],
        total_manhours: totalManhours,
        weather_description: parsed.weather_description,
        weather_conditions: parsed.weather_conditions,
        weather_lost_hours: parsed.weather_lost_hours ?? 0,
        weather_impact: parsed.weather_impact ?? 'None',
        issues,
        summary: parsed.summary,
        source: 'import',
        raw_email_body: text.slice(0, 4000),
        // Store civils-specific data in the summary for now
      }, { onConflict: 'site_id,log_date' })

      if (error) {
        console.error(`  ERROR (db): ${fileName} — ${error.message}`)
        errors++
      } else {
        const crew = parsed.personnel?.length ?? 0
        const acts = parsed.civils_activities?.length ?? 0
        console.log(`  ✓ ${parsed.log_date} — ${crew} people, ${acts} activities, ${parsed.weather_conditions} weather`)
        success++
      }

      // Rate limit: ~3 req/sec to avoid Anthropic throttle
      await new Promise(r => setTimeout(r, 350))

    } catch (e) {
      console.error(`  ERROR: ${fileName} — ${e.message}`)
      errors++
      await new Promise(r => setTimeout(r, 1000))
    }
  }

  // Load existing people from DB to flag unmatched
  const { data: people } = await supabase.from('people').select('name')
  const peopleNames = new Set((people ?? []).map(p => p.name.toLowerCase().trim()))

  const unmatched = [...allPersonnel].filter(name => {
    const n = name.toLowerCase().trim()
    if (peopleNames.has(n)) return false
    // surname match
    const last = n.split(' ').pop()
    for (const pn of peopleNames) {
      if (pn.split(' ').pop() === last && last.length > 2) return false
    }
    return true
  })

  console.log(`\n─────────────────────────────────────────`)
  console.log(`Done: ${success} imported, ${skipped} skipped, ${errors} errors`)
  console.log(`\nAll personnel found across diaries (${allPersonnel.size}):`)
  for (const n of [...allPersonnel].sort()) console.log(`  ${n}`)
  console.log(`\nNOT in staff library (${unmatched.length}) — need creating or matching:`)
  for (const n of unmatched.sort()) console.log(`  ⚠ ${n}`)
}

run().catch(console.error)
