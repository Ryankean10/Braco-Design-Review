/**
 * QCS generation engine
 * Parses an uploaded ITP Excel file, reads column AD for the template ref,
 * hydrates each DOCX template with project + activity details, uploads to
 * Supabase Storage and creates qcs_documents rows.
 */

import * as XLSX from 'xlsx'
import AdmZip from 'adm-zip'
import { createClient } from '@supabase/supabase-js'

// Fallback column indices if header-detection fails
const COL_REF_DEFAULT      = 4
const COL_TITLE_DEFAULT    = 10
const COL_TEMPLATE_DEFAULT = 29

const TEMPLATE_BUCKET = 'qcs-templates'
const QCS_BUCKET      = 'project-qcs'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

/** Extract IPE-SF-ENE-XXX from "IPE-SF-ENE-121 - CON CIV QCS..." */
function extractRef(cell: string): string | null {
  return cell?.match(/^(IPE-SF-ENE-\d+)/)?.[1] ?? null
}

/** Inject a text run into an empty value cell that follows a label cell */
function fillCell(xml: string, label: string, value: string): string {
  // Pattern: label text → closing label cell → opening empty value paragraph
  // We insert a <w:r> run before the closing </w:p> of that value cell
  const labelIdx = xml.indexOf(`<w:t>${label}</w:t>`)
  if (labelIdx === -1) return xml

  // Find the NEXT empty paragraph close after the label cell's closing </w:tc>
  const afterLabel = xml.indexOf('</w:tc>', labelIdx) + 7
  const valueParaEnd = xml.indexOf('</w:p>', afterLabel)
  if (valueParaEnd === -1) return xml

  const run = `<w:r><w:rPr><w:color w:val="0070C0"/></w:rPr><w:t>${escXml(value)}</w:t></w:r>`
  return xml.slice(0, valueParaEnd) + run + xml.slice(valueParaEnd)
}

function escXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Replace the H1 title text in document.xml */
function fillTitle(xml: string, value: string): string {
  // H1 paragraph contains a single <w:t>...</w:t>
  return xml.replace(
    /(<w:pStyle w:val="Heading1"\/>.*?<w:t>)[^<]*/,
    `$1${escXml(value)}`
  )
}

/** Replace the Production Evidence placeholder in header2.xml */
function fillProductionEvidence(xml: string, value: string): string {
  return xml.replace(
    /\(Production Evidence Document Reference Here\)/,
    escXml(value)
  )
}

/** Download a file from Supabase Storage as a Buffer */
async function downloadTemplate(supabase: any, path: string): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(TEMPLATE_BUCKET).download(path)
  if (error || !data) throw new Error(`Failed to download template ${path}: ${error?.message}`)
  const buf = Buffer.from(await data.arrayBuffer())
  return buf
}

export interface ItpRow {
  ref: string           // Column E
  title: string         // Column K
  templateRef: string   // extracted from Column AD
}

export interface Project {
  id: string
  name: string
  client: string
  location: string
}

/** Detect column indices by scanning for the header row containing "QCS / Register Template Title" */
function detectColumns(rows: any[][]): { colRef: number; colTitle: number; colTemplate: number } {
  for (const row of rows.slice(0, 40)) {
    // Must find the exact QCS template column header in this row first
    let tmplCol = -1
    for (let c = 0; c < row.length; c++) {
      const v = String(row[c] ?? '').trim().toLowerCase()
      // Must be a header cell that mentions both "qcs" or "register" AND "template" — not just data
      if ((v.includes('qcs') || v.includes('register')) && v.includes('template') && v.length < 60) {
        tmplCol = c
        break
      }
    }
    if (tmplCol === -1) continue

    // Verify this row also has a "description" or "sequential" header (confirms it's the header row)
    const hasDescription = row.some((c: any) => String(c ?? '').trim().toLowerCase() === 'description')
    const hasSequential  = row.some((c: any) => String(c ?? '').trim().toLowerCase().includes('sequential'))
    if (!hasDescription && !hasSequential) continue

    let colRef   = COL_REF_DEFAULT
    let colTitle = COL_TITLE_DEFAULT
    for (let i = 0; i < row.length; i++) {
      const h = String(row[i] ?? '').trim().toLowerCase()
      if (h.includes('sequential') && h.includes('reference')) colRef = i
      if (h === 'description') colTitle = i
    }
    return { colRef, colTitle, colTemplate: tmplCol }
  }
  return { colRef: COL_REF_DEFAULT, colTitle: COL_TITLE_DEFAULT, colTemplate: COL_TEMPLATE_DEFAULT }
}

/** Parse ITP Excel buffer — returns all rows that have a template in col AD (or equivalent) */
export function parseItpRows(buffer: Buffer): ItpRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer', bookVBA: false })
  // Find the main ITP sheet (not Title Sheet / Data / etc.)
  const sheetName = wb.SheetNames.find(n =>
    n !== 'Title Sheet' && n !== 'Data' && n !== 'Doc Type - FULL' &&
    n !== 'Progress' && !n.includes('LINKS') && !n.includes('Procedures')
  ) ?? wb.SheetNames[0]

  const ws = wb.Sheets[sheetName]
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  const { colRef, colTitle, colTemplate } = detectColumns(rows)

  const result: ItpRow[] = []
  for (const row of rows) {
    const ref      = String(row[colRef] ?? '').trim()
    const title    = String(row[colTitle] ?? '').trim()
    const tmplCell = String(row[colTemplate] ?? '').trim()
    const tmplRef  = extractRef(tmplCell)

    // Must have a doc ref (22163-OCU-QCS-...) and a template ref
    if (!ref.match(/^\d{5}-/) || !tmplRef) continue

    result.push({ ref, title, templateRef: tmplRef })
  }
  return result
}

/** Generate one QCS DOCX from template + project + row data */
async function generateQcs(
  supabase: any,
  templateDocxPath: string,
  row: ItpRow,
  project: Project
): Promise<Buffer> {
  const templateBuf = await downloadTemplate(supabase, templateDocxPath)
  const zip = new AdmZip(templateBuf)

  // -- document.xml --
  let docXml = zip.getEntry('word/document.xml')!.getData().toString('utf8')
  docXml = fillTitle(docXml, row.title)
  docXml = fillCell(docXml, 'Customer', project.client)
  docXml = fillCell(docXml, 'Site', project.location ?? project.name)
  docXml = fillCell(docXml, 'Contract No.', row.ref.split('-')[0])  // e.g. 22163
  zip.updateFile('word/document.xml', Buffer.from(docXml, 'utf8'))

  // -- header2.xml (Production Evidence) --
  const h2Entry = zip.getEntry('word/header2.xml')
  if (h2Entry) {
    let h2Xml = h2Entry.getData().toString('utf8')
    h2Xml = fillProductionEvidence(h2Xml, row.ref)
    zip.updateFile('word/header2.xml', Buffer.from(h2Xml, 'utf8'))
  }

  return zip.toBuffer()
}

export interface GenerateResult {
  created: number
  skipped: number
  errors: string[]
}

/**
 * Main entry point — called after ITP upload.
 * Parses the ITP, generates all QCS docs, uploads to Storage, inserts DB rows.
 */
export async function generateQcsPack(
  itpBuffer: Buffer,
  project: Project,
  userId: string,
  userName: string
): Promise<GenerateResult> {
  const supabase = sb()
  const rows = parseItpRows(itpBuffer)

  // Load all templates once
  const { data: templates } = await supabase
    .from('qcs_templates')
    .select('ref, short_title, docx_path')

  const templateMap = Object.fromEntries((templates ?? []).map((t: any) => [t.ref, t]))

  // Ensure output bucket exists
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.find((b: any) => b.name === QCS_BUCKET)) {
    await supabase.storage.createBucket(QCS_BUCKET, { public: false, fileSizeLimit: 52428800 })
  }

  const result: GenerateResult = { created: 0, skipped: 0, errors: [] }

  for (const row of rows) {
    const tmpl = templateMap[row.templateRef]
    if (!tmpl?.docx_path) {
      result.skipped++
      continue
    }

    // Skip if already generated for this project + ref
    const { data: existing } = await supabase
      .from('qcs_documents')
      .select('id')
      .eq('project_id', project.id)
      .eq('field_data->>'+ 'itp_ref', row.ref)
      .maybeSingle()
    if (existing) { result.skipped++; continue }

    try {
      const docxBuf = await generateQcs(supabase, tmpl.docx_path, row, project)

      // Filename: ColE + " - " + ColK
      const safeTitle = row.title.replace(/[/\\:*?"<>|]/g, '_').substring(0, 100)
      const filename  = `${row.ref} - ${safeTitle}.docx`
      const storagePath = `${project.id}/${filename}`

      const { error: uploadErr } = await supabase.storage
        .from(QCS_BUCKET)
        .upload(storagePath, docxBuf, {
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          upsert: true,
        })

      if (uploadErr) {
        result.errors.push(`Upload failed for ${row.ref}: ${uploadErr.message}`)
        continue
      }

      await supabase.from('qcs_documents').insert({
        project_id:        project.id,
        title:             row.title,
        template_key:      row.templateRef,
        location:          null,
        status:            'wip',
        generated_by:      userId,
        generated_by_name: userName,
        pdf_storage_path:  storagePath,
        field_data: {
          itp_ref:       row.ref,
          contract_code: row.ref.split('-')[0],
          client:        project.client,
          site:          project.location ?? project.name,
        },
      })

      result.created++
    } catch (e: any) {
      result.errors.push(`${row.ref}: ${e.message}`)
    }
  }

  return result
}
