import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { extractAndParse } from '@/lib/repairJson'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Load project + ER document
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (!project.er_storage_path) return NextResponse.json({ error: 'No ER document uploaded' }, { status: 400 })

  // Download ER PDF from storage
  const { data: fileData, error: storageErr } = await supabase.storage
    .from('documents')
    .download(project.er_storage_path)

  if (storageErr || !fileData) {
    return NextResponse.json({ error: `Storage error: ${storageErr?.message}` }, { status: 500 })
  }

  // Extract text from PDF using pdf-parse (CJS module — use createRequire)
  let erText = ''
  try {
    const buf = Buffer.from(await fileData.arrayBuffer())
    const { createRequire } = await import('module')
    const require = createRequire(import.meta.url)
    const pdfParse = require('pdf-parse/lib/pdf-parse.js')
    const parsed = await pdfParse(buf)
    erText = parsed.text
  } catch (e: any) {
    return NextResponse.json({ error: `PDF extraction failed: ${e.message}` }, { status: 500 })
  }

  // Truncate to ~40k chars — enough to capture all standards references without hitting timeout
  const erTextTruncated = erText.length > 40000
    ? erText.slice(0, 40000) + '\n\n[... document truncated for analysis ...]'
    : erText

  // Load full standards library
  const { data: standards } = await supabase
    .from('standards')
    .select('id, ref, title, category, summary')
    .order('category')

  if (!standards?.length) return NextResponse.json({ error: 'No standards in library' }, { status: 400 })

  const libraryList = standards.map(s =>
    `ID:${s.id} | ${s.ref} | ${s.category}`
  ).join('\n')

  // Call Claude — use Haiku for speed, task is structured extraction not reasoning
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `You are a UK BESS (Battery Energy Storage System) engineering standards expert. Analyse the following Employer's Requirements (ER) document and cross-reference it against the provided standards library.

Your tasks:
1. Identify which standards from the library are applicable to this project based on the ER content
2. Identify additional standards, codes or regulations referenced or implied in the ER that are NOT in the library — these are gaps that need to be added

Return ONLY valid JSON in this exact format, no other text:
{
  "applicable_ids": ["uuid1", "uuid2"],
  "missing_standards": [
    {
      "ref": "e.g. BS EN 62477-1:2012",
      "title": "Full standard title",
      "category": "one of: Grid Connection, Protection, Safety, Civils & Geotechnical, Electrical, Fire & BESS Safety, Temporary Works, CDM / H&S, Other",
      "reason": "Brief explanation of why this standard is needed based on ER content (1-2 sentences)"
    }
  ]
}

STANDARDS LIBRARY:
${libraryList}

EMPLOYER'S REQUIREMENTS DOCUMENT:
${erTextTruncated}`
    }]
  })

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

  let result: { applicable_ids: string[]; missing_standards: any[] }
  try {
    result = extractAndParse(responseText)
    if (!Array.isArray(result.applicable_ids)) result.applicable_ids = []
    if (!Array.isArray(result.missing_standards)) result.missing_standards = []
  } catch (e: any) {
    return NextResponse.json({ error: `Failed to parse response: ${e.message}` }, { status: 500 })
  }

  // Auto-link applicable standards (ignore duplicates)
  if (result.applicable_ids?.length) {
    const rows = result.applicable_ids
      .filter(sid => standards.some(s => s.id === sid))
      .map(sid => ({ project_id: projectId, standard_id: sid, added_by: user.id }))

    if (rows.length) {
      await supabase.from('project_standards').upsert(rows, { onConflict: 'project_id,standard_id' })
    }
  }

  // Store missing standards + timestamp on the project
  await supabase.from('projects').update({
    er_missing_standards: result.missing_standards ?? [],
    er_analysed_at: new Date().toISOString(),
  }).eq('id', projectId)

  return NextResponse.json({
    linked: result.applicable_ids?.length ?? 0,
    missing: result.missing_standards ?? [],
  })
}
