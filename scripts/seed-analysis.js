const { createClient } = require('@supabase/supabase-js')
const Anthropic = require('@anthropic-ai/sdk').default
const fs = require('fs')

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').trim().split('\n')
    .filter(l => l.includes('='))
    .map(l => [l.split('=')[0], l.split('=').slice(1).join('=')])
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

async function extractText(filePath) {
  const { data: f, error } = await supabase.storage.from('construction-programmes').download(filePath)
  if (error) throw new Error('Download failed: ' + error.message)
  const buf = Buffer.from(await f.arrayBuffer())
  const pdfParse = require('pdf-parse')
  const result = await pdfParse(buf)
  return result.text?.trim() ?? ''
}

async function analyse(prog) {
  console.log('\n--- Analysing:', prog.site, prog.rev, '---')
  const text = await extractText(prog.file_path)
  console.log('PDF text length:', text.length)

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  const schema = JSON.stringify({
    summary: 'string',
    overall_status: 'On Programme | Slipping | Critical | Ahead',
    completion_date_current: 'date string or null',
    completion_date_previous: null,
    slippage_days: 0,
    status_today: ['bullet describing where project stands today', 'bullet 2', 'bullet 3'],
    critical_path: ['activity name with planned dates'],
    upcoming_activities: [{
      activity: 'activity name',
      due: 'date string',
      days_away: 0,
      impact: 'Critical | Major | Minor',
      note: 'why this matters'
    }],
    key_changes: [],
    risks: ['schedule risk'],
    recommendations: ['specific action'],
    analysed_at: new Date().toISOString()
  }, null, 2)

  const content = `TODAY'S DATE: ${today}

BESS CONSTRUCTION PROGRAMME — ${prog.site} (${prog.rev}):
${text.substring(0, 9000)}

Analyse this Primavera P6 programme relative to today's date. Return a single valid JSON object with no markdown fences, no prose outside the JSON, and no control characters inside strings. Use the schema below as a template (replace example values with real data from the programme):

${schema}`

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 5000,
    messages: [{ role: 'user', content }]
  })

  const raw = msg.content[0].text
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start === -1 || end === -1) {
    console.error('No JSON object found. Raw response:', raw.substring(0, 500))
    return
  }

  let jsonStr = stripped.slice(start, end + 1)
  let analysis
  try {
    analysis = JSON.parse(jsonStr)
  } catch (e) {
    // Response likely truncated — repair by closing open arrays/objects
    console.log('Initial parse failed, attempting repair...')
    let repaired = jsonStr
    // Count unclosed braces/brackets
    let depth = 0, inStr = false, esc = false
    for (const ch of repaired) {
      if (esc) { esc = false; continue }
      if (ch === '\\') { esc = true; continue }
      if (ch === '"') { inStr = !inStr; continue }
      if (!inStr) {
        if (ch === '{' || ch === '[') depth++
        if (ch === '}' || ch === ']') depth--
      }
    }
    // Trim any trailing incomplete entry (comma or partial object)
    repaired = repaired.replace(/,\s*$/, '').replace(/,\s*\{[^}]*$/, '')
    // Close open structures
    const stack = []
    inStr = false; esc = false
    for (const ch of repaired) {
      if (esc) { esc = false; continue }
      if (ch === '\\') { esc = true; continue }
      if (ch === '"') { inStr = !inStr; continue }
      if (!inStr) {
        if (ch === '{') stack.push('}')
        if (ch === '[') stack.push(']')
        if (ch === '}' || ch === ']') stack.pop()
      }
    }
    repaired += stack.reverse().join('')
    try {
      analysis = JSON.parse(repaired)
      console.log('Repair succeeded')
    } catch (e2) {
      console.error('Repair failed:', e2.message)
      return
    }
  }

  console.log('Keys:', Object.keys(analysis).join(', '))
  console.log('status_today:', analysis.status_today?.length, 'upcoming:', analysis.upcoming_activities?.length, 'critical_path:', analysis.critical_path?.length)

  const { error } = await supabase.from('construction_programmes').update({ analysis }).eq('id', prog.id)
  if (error) console.error('Save failed:', error.message)
  else console.log('Saved OK')
}

async function main() {
  const { data: progs, error } = await supabase
    .from('construction_programmes')
    .select('id, site_id, revision, file_path, analysis')
    .order('uploaded_at', { ascending: false })

  if (error) { console.error('Fetch failed:', error.message); process.exit(1) }

  const { data: sites } = await supabase.from('construction_sites').select('id, name')
  const siteMap = Object.fromEntries(sites.map(s => [s.id, s.name]))

  const pending = progs.filter(p => !p.analysis)
  console.log(`Found ${pending.length} programmes without analysis`)

  for (const p of pending) {
    await analyse({ ...p, rev: p.revision, site: siteMap[p.site_id] ?? p.site_id })
  }
  console.log('\nAll done.')
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
