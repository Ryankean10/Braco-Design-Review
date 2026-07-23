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

  const erTextTruncated = erText.length > 45000
    ? erText.slice(0, 45000) + '\n\n[... document truncated ...]'
    : erText

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
      content: `You are an experienced UK civil engineering project manager. Read this contract/Employer's Requirements document and extract all specific tasks, deliverables, and actions that the contractor is required to complete.

Focus on concrete, actionable tasks — not general obligations. Examples: "Submit traffic management plan for approval", "Install 600mm diameter drainage pipe", "Carry out ground investigation survey", "Provide weekly progress reports to client".

Group tasks by stage: Tender, Awarded, Mobilised, Handover, or Complete.

Return ONLY valid JSON, no other text:
{
  "tasks": [
    {
      "task_text": "Concise task description (max 120 chars)",
      "category": "one of: Programme & Planning, Ground Investigation, Drainage, Structural, Traffic Management, H&S / CDM, Reporting, Environmental, Testing & Commissioning, Handover, General",
      "stage": "one of: Tender, Awarded, Mobilised, Handover, Complete"
    }
  ]
}

CONTRACT / ER DOCUMENT:
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
