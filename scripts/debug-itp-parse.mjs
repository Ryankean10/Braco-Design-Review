/**
 * Debug: parse ITP from Supabase storage and show what the QCS generator sees
 * Run: node scripts/debug-itp-parse.mjs <projectId>
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import * as XLSX from 'xlsx'

const envLines = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')
const env = {}
for (const line of envLines) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '')
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

const projectId = process.argv[2]
if (!projectId) { console.error('Usage: node scripts/debug-itp-parse.mjs <projectId>'); process.exit(1) }

function extractRef(cell) {
  return cell?.match(/^(IPE-SF-ENE-\d+)/)?.[1] ?? null
}

function detectColumns(rows) {
  for (const row of rows.slice(0, 40)) {
    let tmplCol = -1
    for (let c = 0; c < row.length; c++) {
      const v = String(row[c] ?? '').trim().toLowerCase()
      if ((v.includes('qcs') || v.includes('register')) && v.includes('template') && v.length < 60) {
        tmplCol = c; break
      }
    }
    if (tmplCol === -1) continue
    const hasDescription = row.some(c => String(c ?? '').trim().toLowerCase() === 'description')
    const hasSequential  = row.some(c => String(c ?? '').trim().toLowerCase().includes('sequential'))
    if (!hasDescription && !hasSequential) continue

    let colRef = 4, colTitle = 10
    for (let i = 0; i < row.length; i++) {
      const h = String(row[i] ?? '').trim().toLowerCase()
      if (h.includes('sequential') && h.includes('reference')) colRef = i
      if (h === 'description') colTitle = i
    }
    console.log(`→ Detected columns: ref=${colRef} title=${colTitle} template=${tmplCol}`)
    return { colRef, colTitle, colTemplate: tmplCol }
  }
  console.log('→ Using default columns: ref=4 title=10 template=29')
  return { colRef: 4, colTitle: 10, colTemplate: 29 }
}

async function run() {
  // Get ITP record
  const { data: itps } = await sb.from('project_itps').select('*').eq('project_id', projectId).order('uploaded_at', { ascending: false }).limit(1)
  if (!itps?.length) { console.error('No ITP found for project'); process.exit(1) }
  console.log('ITP file:', itps[0].file_name)
  console.log('Storage path:', itps[0].storage_path)

  // Download
  const { data: fileData, error } = await sb.storage.from('documents').download(itps[0].storage_path)
  if (error) { console.error('Download failed:', error.message); process.exit(1) }
  const buf = Buffer.from(await fileData.arrayBuffer())
  console.log('Downloaded:', buf.length, 'bytes\n')

  // Parse
  const wb = XLSX.read(buf, { type: 'buffer', bookVBA: false })
  console.log('Sheets:', wb.SheetNames.join(', '))

  // Show which sheet would be selected
  const selected = wb.SheetNames.find(n =>
    n !== 'Title Sheet' && n !== 'Data' && n !== 'Doc Type - FULL' &&
    n !== 'Progress' && !n.includes('LINKS') && !n.includes('Procedures')
  ) ?? wb.SheetNames[0]
  console.log('→ Selected sheet:', selected, '\n')

  const ws = wb.Sheets[selected]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  console.log('Total rows:', rows.length)

  const { colRef, colTitle, colTemplate } = detectColumns(rows)

  let matchCount = 0
  let noRefCount = 0
  let noTemplateCount = 0
  const templateRefs = new Set()

  for (const row of rows) {
    const ref      = String(row[colRef] ?? '').trim()
    const title    = String(row[colTitle] ?? '').trim()
    const tmplCell = String(row[colTemplate] ?? '').trim()
    const tmplRef  = extractRef(tmplCell)

    if (!ref && !title && !tmplCell) continue  // blank row

    if (!ref.match(/^\d{5}-/)) { noRefCount++; continue }
    if (!tmplRef) { noTemplateCount++; continue }

    matchCount++
    templateRefs.add(tmplRef)
    if (matchCount <= 5) {
      console.log(`  Row: ref="${ref}" title="${title}" template="${tmplRef}"`)
    }
  }

  console.log(`\nParsed: ${matchCount} valid rows, ${noRefCount} skipped (no ref), ${noTemplateCount} skipped (no template)`)
  console.log('Unique template refs:', [...templateRefs].sort().join(', '))

  // Check which templates have docx_path in DB
  const { data: templates } = await sb.from('qcs_templates').select('ref, docx_path').in('ref', [...templateRefs])
  const withPath = templates?.filter(t => t.docx_path) ?? []
  const withoutPath = templates?.filter(t => !t.docx_path) ?? []
  console.log(`\nTemplate DB check: ${withPath.length} have docx_path, ${withoutPath.length} missing docx_path`)
  if (withoutPath.length) console.log('Missing:', withoutPath.map(t => t.ref).join(', '))

  const notInDb = [...templateRefs].filter(r => !templates?.find(t => t.ref === r))
  if (notInDb.length) console.log('Not in DB at all:', notInDb.join(', '))
}

run().catch(console.error)
