/**
 * Upload QCS template files to Supabase Storage and update qcs_templates table
 * Run: node scripts/seed-qcs-templates.mjs
 *
 * Expects template files in: C:/Users/admin/Downloads/qcs_templates/
 * Creates bucket: qcs-templates (set to private)
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'

const envLines = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')
const env = {}
for (const line of envLines) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '')
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

const TEMPLATE_DIR = 'C:/Users/admin/Downloads/qcs_templates'
const BUCKET = 'qcs-templates'

// Parse filename → ref code
// e.g. "IPE-SF-ENE-007_T&C QCS..._1.0_0.pdf" → { ref: 'IPE-SF-ENE-007', ext: 'pdf' }
function parseFilename(name) {
  const ref = name.match(/^(IPE-SF-ENE-\d+)/)?.[1] ?? null
  const ext = name.split('.').pop().toLowerCase()
  return { ref, ext }
}

async function run() {
  // Ensure bucket exists
  const { data: buckets } = await sb.storage.listBuckets()
  if (!buckets?.find(b => b.name === BUCKET)) {
    const { error } = await sb.storage.createBucket(BUCKET, { public: false, fileSizeLimit: 20971520 })
    if (error) { console.error('Failed to create bucket:', error.message); process.exit(1) }
    console.log(`✓ Created bucket: ${BUCKET}`)
  } else {
    console.log(`  Bucket ${BUCKET} already exists`)
  }

  const files = readdirSync(TEMPLATE_DIR)
  console.log(`\nFound ${files.length} files in template directory\n`)

  // Group files by ref (one docx + one pdf per ref)
  const byRef = {}
  for (const file of files) {
    const { ref, ext } = parseFilename(file)
    if (!ref || !['docx', 'pdf'].includes(ext)) continue
    if (!byRef[ref]) byRef[ref] = {}
    byRef[ref][ext] = file
  }

  console.log(`Found ${Object.keys(byRef).length} template refs\n`)

  let uploaded = 0
  let updated = 0
  let errors = 0

  for (const [ref, fileMap] of Object.entries(byRef)) {
    const paths = {}

    for (const [ext, filename] of Object.entries(fileMap)) {
      const localPath = `${TEMPLATE_DIR}/${filename}`
      const storagePath = `${ref}/${filename}`
      const contentType = ext === 'pdf' ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

      try {
        const fileBytes = readFileSync(localPath)
        const { error } = await sb.storage.from(BUCKET).upload(storagePath, fileBytes, {
          contentType,
          upsert: true,
        })
        if (error) {
          console.error(`  ✗ Upload failed ${filename}: ${error.message}`)
          errors++
        } else {
          paths[ext === 'pdf' ? 'pdf_path' : 'docx_path'] = storagePath
          uploaded++
        }
      } catch (e) {
        console.error(`  ✗ Read failed ${filename}: ${e.message}`)
        errors++
      }
    }

    // Update the DB record with storage paths
    if (Object.keys(paths).length > 0) {
      const { error } = await sb.from('qcs_templates').update(paths).eq('ref', ref)
      if (error) {
        console.error(`  ✗ DB update failed for ${ref}: ${error.message}`)
        errors++
      } else {
        console.log(`  ✓ ${ref} — ${Object.keys(paths).map(k => k.replace('_path','')).join(' + ')}`)
        updated++
      }
    }
  }

  console.log(`\n─────────────────────────────────`)
  console.log(`Uploaded: ${uploaded} files`)
  console.log(`DB rows updated: ${updated}`)
  console.log(`Errors: ${errors}`)

  // Verify
  const { data: templates, error: fetchErr } = await sb.from('qcs_templates').select('ref, docx_path, pdf_path').order('ref')
  if (!fetchErr) {
    const withFiles = templates.filter(t => t.docx_path || t.pdf_path)
    console.log(`\n${withFiles.length}/${templates.length} templates have files attached`)
    const missing = templates.filter(t => !t.docx_path && !t.pdf_path)
    if (missing.length > 0) console.log('Missing files:', missing.map(t => t.ref).join(', '))
  }
}

run().catch(console.error)
