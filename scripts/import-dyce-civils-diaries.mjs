/**
 * Import Dyce civils PDF diaries into site_daily_logs
 * Merges civils data into existing electrical diary entries for the same date
 * Run: node scripts/import-dyce-civils-diaries.mjs
 */
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, join, extname } from 'path'

const envLines = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')
const env = {}
for (const line of envLines) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '')
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

const DYCE_SITE_ID = '00000000-0000-0000-0000-000000000001'
const DIARY_DIR = 'C:/Users/admin/Downloads/dyce_civils'

const SYSTEM_PROMPT = `You are a construction data extractor for the Dyce 30MW BESS site in Aberdeen, Scotland.
Extract structured data from civils site diary PDFs. These are daily progress reports covering groundworks, cable ducting, drainage, access roads, and other civils activities at the BESS site.

Return ONLY valid JSON (no markdown, no backticks):
{
  "log_date": "YYYY-MM-DD",
  "weather_description": "string or null",
  "weather_conditions": "Good|Fair|Poor",
  "weather_lost_hours": number,
  "weather_impact": "None|Low|Medium|High",
  "personnel": [
    { "name": "string", "role": "Worker|Ganger|Site Manager|Engineer|Visitor|Other", "company": "string", "hours": number, "note": "string or null" }
  ],
  "civils_activities": ["brief description of each activity completed today"],
  "plant_on_site": ["list of plant/equipment present"],
  "deliveries": ["list of materials delivered"],
  "issues": [
    { "description": "string", "impact": "Low|Medium|High|Critical", "status": "Open|Closed", "action": "string or null" }
  ],
  "summary": "1-2 sentence summary of civils progress today"
}

Rules:
- Estimate 10h per person unless diary states otherwise
- weather_conditions: Good = dry/sunny, Fair = overcast/light rain, Poor = heavy rain/wind/snow
- Focus on civils activities only (groundworks, ducting, drainage, concrete, access, fencing, etc.)
- Extract all personnel mentioned regardless of role`

async function extractFromPDF(pdfPath) {
  const pdfBytes = readFileSync(pdfPath)
  const base64 = pdfBytes.toString('base64')

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [{
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 }
      }, {
        type: 'text',
        text: 'Extract all civils diary data from this PDF and return as JSON.'
      }]
    }]
  })

  const raw = msg.content[0].text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  return JSON.parse(raw)
}

function walkPDFs(dir) {
  const results = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) results.push(...walkPDFs(full))
    else if (extname(name).toLowerCase() === '.pdf') results.push(full)
  }
  return results.sort()
}

async function run() {
  const files = walkPDFs(DIARY_DIR)
  console.log(`\nFound ${files.length} PDF files\n`)

  for (const filePath of files) {
    const fileName = filePath.split(/[\\/]/).pop()
    try {
      console.log(`Processing: ${fileName}`)
      const parsed = await extractFromPDF(filePath)

      if (!parsed.log_date?.match(/^\d{4}-\d{2}-\d{2}$/)) {
        console.log(`  SKIP — no valid date extracted`)
        continue
      }

      // Check if an existing log entry exists for this date (from electrical diary)
      const { data: existing } = await sb
        .from('site_daily_logs')
        .select('id, personnel, issues, summary, civils_activities')
        .eq('site_id', DYCE_SITE_ID)
        .eq('log_date', parsed.log_date)
        .maybeSingle()

      const civiIsActivities = parsed.civils_activities ?? []
      const newIssues = parsed.issues ?? []
      const newPersonnel = parsed.personnel ?? []

      if (existing) {
        // Merge civils data into existing electrical entry
        const existingPersonnel = existing.personnel ?? []
        const existingIssues = existing.issues ?? []

        // Add civils personnel not already listed (by name)
        const existingNames = new Set(existingPersonnel.map((p) => p.name?.toLowerCase()))
        const newCivilsPersonnel = newPersonnel.filter(p => !existingNames.has(p.name?.toLowerCase()))
        const mergedPersonnel = [...existingPersonnel, ...newCivilsPersonnel]

        // Append civils issues
        const mergedIssues = [...existingIssues, ...newIssues]

        // Append civils summary to existing
        const mergedSummary = existing.summary
          ? `${existing.summary}\n\nCivils: ${parsed.summary}`
          : parsed.summary

        const { error } = await sb.from('site_daily_logs').update({
          personnel: mergedPersonnel,
          issues: mergedIssues,
          summary: mergedSummary,
          civils_activities: civiIsActivities,
          total_manhours: mergedPersonnel.reduce((s, p) => s + (p.hours ?? 10), 0),
        }).eq('id', existing.id)

        if (error) console.error(`  ERROR merging: ${error.message}`)
        else console.log(`  ✓ Merged into existing ${parsed.log_date} entry — ${newCivilsPersonnel.length} new personnel, ${civiIsActivities.length} civils activities, ${newIssues.length} issues`)
      } else {
        // No electrical entry — create a new civils-only log
        const totalManhours = newPersonnel.reduce((s, p) => s + (p.hours ?? 10), 0)
        const { error } = await sb.from('site_daily_logs').insert({
          site_id: DYCE_SITE_ID,
          log_date: parsed.log_date,
          personnel: newPersonnel,
          total_manhours: totalManhours,
          weather_description: parsed.weather_description,
          weather_conditions: parsed.weather_conditions,
          weather_lost_hours: parsed.weather_lost_hours ?? 0,
          weather_impact: parsed.weather_impact ?? 'None',
          issues: newIssues,
          summary: parsed.summary,
          civils_activities: civiIsActivities,
          source: 'import',
          raw_email_body: `Civils diary PDF: ${fileName}`,
        })
        if (error) console.error(`  ERROR inserting: ${error.message}`)
        else console.log(`  ✓ Created new civils log for ${parsed.log_date} — ${newPersonnel.length} personnel, ${civiIsActivities.length} activities`)
      }

      await new Promise(r => setTimeout(r, 500))
    } catch (e) {
      console.error(`  ERROR: ${fileName} — ${e.message}`)
    }
  }

  console.log('\nDone.')
}

run().catch(console.error)
