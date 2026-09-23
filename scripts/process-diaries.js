/**
 * process-diaries.js
 * Batch-process OCU Group daily report PDFs into site_diaries + civils_activities.
 *
 * Usage:
 *   node scripts/process-diaries.js <path-to-folder-or-zip>
 *
 * The script will:
 *   1. If given a ZIP, extract it to a temp folder first
 *   2. Find all PDFs recursively
 *   3. Parse structured fields from the OCU IPE-SF-OPS-055 format deterministically
 *   4. Use Claude to map "Actual works detail" to the Dyce civils activity register
 *   5. Insert into site_diaries and update civils_activities (never regressing progress)
 *   6. Skip PDFs already in the DB (idempotent by diary_date + file_name)
 */

const { createClient } = require('@supabase/supabase-js')
const fs      = require('fs')
const path    = require('path')
const pdf     = require('pdf-parse')
const mammoth = require('mammoth')
const Anthropic = require('@anthropic-ai/sdk')

// ── env ─────────────────────────────────────────────────────────────────────
const env = Object.fromEntries(
  fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8').trim().split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.split('=')[0].trim(), l.split('=').slice(1).join('=').trim()])
)
const supabase  = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

// ── helpers ──────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function extractField(text, ...labels) {
  for (const label of labels) {
    const re = new RegExp(label + '[:\\s]+([^\\n]+)', 'i')
    const m  = text.match(re)
    if (m) return m[1].trim()
  }
  return null
}

function parseDate(raw) {
  if (!raw) return null
  // handles "01-Jun-2026", "01/06/2026", "2026-06-01"
  const d = new Date(raw.replace(/(\d{2})-([A-Za-z]{3})-(\d{4})/, '$1 $2 $3'))
  if (!isNaN(d)) return d.toISOString().split('T')[0]
  return null
}

function parseCrew(text) {
  const ipe  = parseInt(extractField(text, 'Number IPE staff', 'IPE staff') ?? '0') || 0
  const cont = parseInt(extractField(text, 'Number of contractors', 'contractors') ?? '0') || 0
  return ipe + cont || null
}

/** Pull the multi-line "Actual works detail" block */
function parseActualWorks(text) {
  const m = text.match(/Actual works detail[:\s]*\n([\s\S]*?)(?:\n\s*\n|\nDetails of shortfall|\nEstimated cost)/i)
  return m ? m[1].trim() : ''
}

function parsePlannedWorks(text) {
  const m = text.match(/Planned works detail[:\s]*\n([\s\S]*?)(?:\n\s*\n|\n%\s*Actual|\nActual works)/i)
  return m ? m[1].trim() : ''
}

/** Find all PDFs and DOCX files under a directory, sorted by filename */
function findPdfs(dir) {
  const results = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) results.push(...findPdfs(full))
    else if (/\.(pdf|docx)$/i.test(entry.name)) results.push(full)
  }
  return results.sort()
}

/** Extract plain text from PDF or DOCX */
async function extractTextFromFile(filePath) {
  if (filePath.toLowerCase().endsWith('.docx')) {
    const result = await mammoth.extractRawText({ path: filePath })
    return result.value
  }
  const buf = fs.readFileSync(filePath)
  const result = await pdf(buf)
  return result.text
}

/** Parse the PRODUCTION table from OCU daily shift report (docx format)
 *  Returns array of { task, pct, comment } */
function parseProductionTable(text) {
  const rows = []
  // The table renders as: task name\nPct%\ncomment (or task\tpct\tcomment)
  // We look for the block between PRODUCTION header and TIMELINE
  const block = text.match(/PRODUCTION[\s\S]*?Planned Tasks.*?\n([\s\S]*?)(?:TIMELINE|PLANT REQUIREMENTS)/i)
  if (!block) return rows
  const lines = block[1].split('\n').map(l => l.trim()).filter(Boolean)
  // Lines come in groups: task, pct%, comment (or task, pct%)
  // Skip the header row "Percentage Complete % Comments"
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    // Skip header lines
    if (/^Percentage Complete|^Comments$/i.test(line)) { i++; continue }
    // If next line looks like a percentage
    const pctLine = lines[i + 1] ?? ''
    const pctMatch = pctLine.match(/^(\d+)\s*%$/)
    if (pctMatch) {
      const comment = lines[i + 2] && !lines[i + 2].match(/^\d+\s*%$/) ? lines[i + 2] : ''
      rows.push({ task: line, pct: parseInt(pctMatch[1]), comment })
      i += comment ? 3 : 2
    } else {
      i++
    }
  }
  return rows
}

/** Parse date from docx format: looks for DD/MM/YYYY after DATE label */
function parseDateDocx(text) {
  const m = text.match(/DATE\s*\n?\s*(\d{2}\/\d{2}\/\d{4})/i)
  if (m) {
    const [d, mo, y] = m[1].split('/')
    return `${y}-${mo}-${d}`
  }
  return null
}

/** Parse crew count from RESOURCES section of docx */
function parseCrewDocx(text) {
  const block = text.match(/RESOURCES[\s\S]*?(?:ADDITIONAL INFORMATION|COMPLETED BY)/i)
  if (!block) return null
  const names = (block[0].match(/\b[A-Z][a-z]+ [A-Z][a-z]+/g) ?? [])
    .filter(n => !['Site Manager','Tommy Golden','Andy Lee','Additional Information'].includes(n))
  // Count named workers (rough heuristic — count non-header name-like entries)
  const rows = block[0].split('\n').filter(l => /[A-Z][a-z]+ [A-Z][a-z]+/.test(l) && !/Manager|Engineer|Supervisor|Operator|Labourer|Competence/i.test(l))
  return rows.length || null
}

/** Parse weather from docx */
function parseWeatherDocx(text) {
  const m = text.match(/Weather:\s*([^\n]+)/i)
  return m ? m[1].trim() : null
}

/** Extract a ZIP using the built-in Node AdmZip (install if needed) or shell */
async function extractZip(zipPath) {
  const outDir = zipPath.replace(/\.zip$/i, '_extracted')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  // Try native unzip
  const { execSync } = require('child_process')
  try {
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${outDir}' -Force"`)
  } catch {
    execSync(`unzip -o "${zipPath}" -d "${outDir}"`)
  }
  return outDir
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const input = process.argv[2]
  if (!input) {
    console.error('Usage: node scripts/process-diaries.js <folder-or-zip-path>')
    process.exit(1)
  }

  // Resolve input
  let folder = input
  if (input.toLowerCase().endsWith('.zip')) {
    console.log('📦 Extracting ZIP…')
    folder = await extractZip(input)
    console.log(`   Extracted to: ${folder}`)
  }

  const pdfs = findPdfs(folder)
  console.log(`\n📄 Found ${pdfs.length} PDFs\n`)

  // Load Dyce site + civils activities
  const { data: site } = await supabase
    .from('construction_sites')
    .select('id, name')
    .ilike('name', '%dyce%')
    .single()

  if (!site) { console.error('❌ Dyce construction site not found'); process.exit(1) }
  console.log(`✅ Site: ${site.name} (${site.id})\n`)

  const { data: activities } = await supabase
    .from('civils_activities')
    .select('id, activity_group, description, category, status, progress_pct')
    .eq('site_id', site.id)
    .order('sort_order')

  const activityList = (activities ?? [])
    .map(a => `- ${a.activity_group} [${a.category}] — current: ${a.status}, ${a.progress_pct}%`)
    .join('\n')

  console.log(`📋 Loaded ${(activities ?? []).length} civils activities\n`)
  console.log('─'.repeat(60))

  let inserted = 0, skipped = 0, errors = 0

  for (const filePath of pdfs) {
    const fileName = path.basename(filePath)
    process.stdout.write(`\n[${pdfs.indexOf(filePath) + 1}/${pdfs.length}] ${fileName} … `)

    try {
      const isDocx = filePath.toLowerCase().endsWith('.docx')

      // Extract text
      const text = await extractTextFromFile(filePath)

      // Parse structured fields — format differs between PDF (IPE-SF-OPS-055) and DOCX (OCU shift report)
      let diaryDate, weather, crewCount, worksText, productionRows

      if (isDocx) {
        // OCU daily shift report format
        diaryDate = parseDateDocx(text)
        // Fallback: filename like "Daily Shift Report - OCU - TG - 02.02.26.docx"
        if (!diaryDate) {
          const fm = fileName.match(/(\d{2})\.(\d{2})\.(\d{2})\.docx$/i)
          if (fm) diaryDate = `20${fm[3]}-${fm[2]}-${fm[1]}`
        }
        weather    = parseWeatherDocx(text)
        crewCount  = parseCrewDocx(text)
        productionRows = parseProductionTable(text)
        worksText  = productionRows.map(r => `${r.task}: ${r.pct}% complete. ${r.comment}`).join('\n') || '(not recorded)'
      } else {
        // PDF IPE-SF-OPS-055 format
        const dateMatch = text.match(/(?:^|\n)\s*Date\s*\n\s*(\d{1,2}[-\/][A-Za-z0-9]{2,3}[-\/]\d{4})/i)
                       ?? text.match(/(?:^|\n)\s*Date[:\s]+(\d{1,2}[-\/][A-Za-z0-9]{2,3}[-\/]\d{4})/i)
        const rawDate  = dateMatch ? dateMatch[1] : null
        const fileDate = fileName.match(/-(\d{1,2}-[A-Za-z]{3}-\d{4})-/)
        diaryDate  = parseDate(rawDate) ?? parseDate(fileDate ? fileDate[1] : null)
        weather    = extractField(text, 'Weather')
        crewCount  = parseCrew(text)
        const actualWork  = parseActualWorks(text)
        const plannedWork = parsePlannedWorks(text)
        worksText  = (actualWork && actualWork.length > 3) ? actualWork : plannedWork
        productionRows = []
      }

      if (!diaryDate) {
        console.log(`⚠️  Could not parse date — skipped`)
        skipped++; continue
      }

      // Idempotency check
      const { data: existing } = await supabase
        .from('site_diaries')
        .select('id')
        .eq('site_id', site.id)
        .eq('diary_date', diaryDate)
        .eq('file_name', fileName)
        .maybeSingle()

      if (existing) {
        console.log(`⏭️  Already imported (${diaryDate})`)
        skipped++; continue
      }

      // Claude: map works → civils activities
      const productionContext = productionRows.length
        ? `\nPRODUCTION TABLE (task name | reported % complete | comment):\n${productionRows.map(r => `  ${r.task} | ${r.pct}% | ${r.comment || '-'}`).join('\n')}\n`
        : ''

      // Claude: map actual works → civils activities
      const prompt = `You are analysing an OCU Group daily site report for a Battery Energy Storage System (BESS) construction project in Dyce, Aberdeen.

CURRENT CIVILS ACTIVITY REGISTER:
${activityList}

DIARY DATE: ${diaryDate}
WEATHER: ${weather ?? 'not recorded'}
CREW ON SITE: ${crewCount ?? 'not recorded'}
${productionContext}
WORKS NARRATIVE:
${worksText || '(not recorded)'}

Your task: identify any civils activities from the register that were worked on today, and estimate their OVERALL project progress_pct.

Important notes:
- If a production table is provided, the percentages in it are the REPORTED COMPLETION for that specific task — use these as strong evidence for progress_pct
- Only update civils activities — electrical/cable/commissioning work (glanding, terminating, jointing, Sungrow, IDNO, MV/LV) should be ignored
- Civils = excavations, foundations, drainage, fencing, masonry walls, troughs, access road, concrete, blackjacking, piling
- Be conservative — only update if clearly evidenced; never reduce below current progress_pct

Return a JSON object:
{
  "ai_summary": "1-2 sentence summary of the day focused on civils works (or note if purely electrical day)",
  "ai_weather": "${weather ?? 'Rainy'}",
  "ai_crew_count": ${crewCount ?? null},
  "ai_activities": [
    {
      "activity_group": "exact name from register — do NOT append [Below Ground] or [Above Ground]",
      "progress_pct": 0-100,
      "status": "Not Started|In Progress|Complete|Blocked",
      "note": "brief note"
    }
  ],
  "ai_blockers": []
}

Only include activities in ai_activities if genuinely evidenced. Return valid JSON only.`

      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      })

      let aiData = { ai_summary: null, ai_weather: weather, ai_crew_count: crewCount, ai_activities: [], ai_blockers: [] }
      try {
        const raw = msg.content[0].text
        const match = raw.match(/\{[\s\S]*\}/)
        if (match) aiData = { ...aiData, ...JSON.parse(match[0]) }
      } catch { /* use defaults */ }

      // Insert diary record
      const { data: diary, error: dErr } = await supabase
        .from('site_diaries')
        .insert({
          site_id:        site.id,
          diary_date:     diaryDate,
          file_name:      fileName,
          raw_text:       text.slice(0, 8000), // cap to avoid huge text blobs
          ai_summary:     aiData.ai_summary,
          ai_weather:     aiData.ai_weather ?? weather,
          ai_crew_count:  aiData.ai_crew_count ?? crewCount,
          ai_activities:  aiData.ai_activities ?? [],
          ai_blockers:    aiData.ai_blockers ?? [],
          ai_analysed_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (dErr) throw new Error(dErr.message)

      // Apply activity updates
      let updatedCount = 0
      for (const update of (aiData.ai_activities ?? [])) {
        // Strip any " [Category]" suffix Claude may append, then match
        const cleanName = (update.activity_group ?? '').replace(/\s*\[.*?\]\s*$/, '').toLowerCase()
        const act = (activities ?? []).find(a =>
          a.activity_group.toLowerCase() === cleanName
        )
        if (!act) continue
        const newPct = Math.max(act.progress_pct, update.progress_pct ?? 0)
        await supabase
          .from('civils_activities')
          .update({
            status:            update.status ?? act.status,
            progress_pct:      newPct,
            progress_note:     update.note ?? null,
            last_diary_update: new Date(diaryDate).toISOString(),
            updated_at:        new Date().toISOString(),
          })
          .eq('id', act.id)

        // Keep local copy current so later diaries don't regress
        act.progress_pct = newPct
        act.status = update.status ?? act.status
        updatedCount++
      }

      console.log(`✅ ${diaryDate} — ${updatedCount} civils activities updated`)
      inserted++

      // Polite delay to avoid hammering the Claude API
      await sleep(800)

    } catch (err) {
      console.log(`❌ ERROR: ${err.message}`)
      errors++
    }
  }

  console.log('\n' + '─'.repeat(60))
  console.log(`\n✅ Done — ${inserted} imported, ${skipped} skipped, ${errors} errors`)
  console.log('\nReload the Dyce construction site to see updated civils progress.\n')
}

main().catch(e => { console.error(e); process.exit(1) })
