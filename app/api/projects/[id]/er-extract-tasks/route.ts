import { NextRequest, NextResponse } from 'next/server'
export const maxDuration = 60

import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { extractAndParse } from '@/lib/repairJson'
import { requireRole, INTERNAL_ROLES } from '@/lib/auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const auth = await requireRole(INTERNAL_ROLES)
  if ('error' in auth) return auth.error
  const supabase = await createClient()

  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single()
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (!project.er_storage_path) return NextResponse.json({ error: 'No ER document uploaded' }, { status: 400 })

  const { data: fileData, error: storageErr } = await supabase.storage
    .from('documents').download(project.er_storage_path)
  if (storageErr || !fileData) return NextResponse.json({ error: `Storage error: ${storageErr?.message}` }, { status: 500 })

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

  // Find the scope section — use the LAST occurrence of each keyword because contracts
  // typically list "Annexure 1" in the table of contents first, then again at the actual section.
  // The last occurrence is the real heading; TOC references appear early and would send boilerplate.
  const SCOPE_KEYWORDS = [
    'Annexure 1', 'ANNEXURE 1', 'Annexure 01',
    'Appendix 1', 'APPENDIX 1',
    'Activity Schedule', 'ACTIVITY SCHEDULE',
    'Bill of Quantities', 'BILL OF QUANTITIES',
    'Schedule of Works', 'SCHEDULE OF WORKS',
    'Works Information', 'WORKS INFORMATION',
    'Scope of Works', 'SCOPE OF WORKS',
  ]

  function lastIndexOf(text: string, keyword: string): number {
    let last = -1
    let idx = 0
    while ((idx = text.indexOf(keyword, idx)) !== -1) { last = idx; idx++ }
    return last
  }

  let scopeText = ''
  for (const kw of SCOPE_KEYWORDS) {
    const idx = lastIndexOf(erText, kw)
    if (idx !== -1) {
      // Take from 200 chars before the keyword up to 50,000 chars after
      const start = Math.max(0, idx - 200)
      scopeText = erText.slice(start, start + 50000)
      break
    }
  }

  // Fall back to first 45,000 chars if no scope section found
  const erTextTruncated = scopeText
    ? scopeText + (scopeText.length >= 50000 ? '\n\n[... document truncated ...]' : '')
    : erText.slice(0, 45000) + (erText.length > 45000 ? '\n\n[... document truncated ...]' : '')

  // Load existing tasks for this revision to avoid duplicates
  const { data: existingTasks } = await supabase
    .from('er_tasks')
    .select('task_text, source_revision')
    .eq('project_id', projectId)
    .eq('source_revision', project.er_storage_path)

  const existingTexts = new Set((existingTasks ?? []).map((t: any) => t.task_text.toLowerCase().trim()))

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: `You are a UK site manager and quantity surveyor reading a construction contract. Your job is to extract the physical scope of works — the actual construction activities that will be carried out on site.

IMPORTANT: The scope of works is almost never in the main contract conditions. Look for it in sections labelled: "Scope of Works", "Works Information", "Annexure 1", "Appendix 1", "Activity Schedule", "Bill of Quantities", "Schedule of Works", or similar. These sections contain the real construction items.

The main contract body (NEC, JCT, bespoke conditions, Z-clauses etc.) contains legal obligations and programme requirements — IGNORE those entirely. Do not extract anything from numbered contract clauses like "The Subcontractor shall...", "In accordance with clause...", etc.

WHAT TO EXTRACT — physical site activities only. For BESS/energy projects these typically include:
- Pile cropping or pile installation
- Foundations (battery unit, inverter, transformer, DNO, substation — typically with quantities e.g. "7no")
- Drainage (attenuation tanks, twinwall pipe, ACO channels, manholes/catchpits)
- Retaining walls (Legato block, concrete, gabion — with dimensions)
- Surfacing (Type 1 subbase, tarmac binder + surface course, stone chips, kerbs)
- Cable ducting and draw pits
- Fencing (palisade, security, gates) and boundary walls
- Landscaping (trees, shrubs, grass seeding)
- Earthworks and site levelling
- Access roads and bellmouths

For general civils projects these typically include:
- Excavation and earthworks
- Drainage pipework and structures
- Road construction (subbase, binder, surface, kerbs, markings)
- Structures (bridges, culverts, retaining walls)
- Services diversions and reinstatement

Each task should correspond to a distinct scope item, ideally with quantities or dimensions where stated in the document.

Return ONLY valid JSON, no other text:
{
  "tasks": [
    {
      "task_text": "Concise description of the construction activity including key quantities/dimensions (max 140 chars)",
      "category": "one of: Piling & Foundations, Drainage & Attenuation, Earthworks & Levelling, Surfacing & Roads, Retaining Walls & Structures, Fencing & Boundary, Cable Ducting & Draw Pits, Landscaping, Temporary Works & Prelims, Mechanical & Electrical, Testing & Commissioning, General",
      "stage": "one of: Awarded, Mobilised, Handover, Complete"
    }
  ]
}

CONTRACT / SCOPE DOCUMENT:
${erTextTruncated}`
    }]
  })

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
  let result: { tasks: any[] }
  try {
    result = extractAndParse(responseText)
    if (!Array.isArray(result.tasks)) result.tasks = []
  } catch (e: any) {
    return NextResponse.json({ error: `Failed to parse response: ${e.message}` }, { status: 500 })
  }

  // Filter out duplicates (same task text already exists for this revision)
  const newTasks = result.tasks.filter((t: any) => {
    const txt = (t.task_text ?? '').toLowerCase().trim()
    return txt.length > 0 && !existingTexts.has(txt)
  })

  if (newTasks.length > 0) {
    await supabase.from('er_tasks').insert(
      newTasks.map((t: any) => ({
        project_id: projectId,
        task_text: t.task_text,
        category: t.category ?? 'General',
        stage: t.stage ?? 'Mobilised',
        source_revision: project.er_storage_path,
      }))
    )
  }

  // Return all tasks for this project
  const { data: allTasks } = await supabase
    .from('er_tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('stage')
    .order('created_at')

  return NextResponse.json({ tasks: allTasks ?? [], newCount: newTasks.length })
}
