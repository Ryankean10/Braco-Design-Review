import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { extractAndParse } from '@/lib/repairJson'

export const maxDuration = 300

interface TechFinding {
  category: 'specification' | 'compliance_check' | 'lessons_learned' | 'construction' | 'safety' | 'general'
  severity: 'High' | 'Medium' | 'Low' | 'Information'
  title: string
  detail: string
  page_ref?: string
  cross_ref?: string   // e.g. "BRA-EL-001 Rev P01 states 95mm²"
  value_extracted?: string  // e.g. "95mm² LV DC cable"
}

async function extractPdfText(fileData: Blob): Promise<string> {
  const buf = Buffer.from(await fileData.arrayBuffer())
  const { createRequire } = await import('module')
  const require = createRequire(import.meta.url)
  const pdfParse = require('pdf-parse/lib/pdf-parse.js')
  const parsed = await pdfParse(buf)
  return (parsed.text as string) ?? ''
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: techDocId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'engineer'].includes(profile?.role ?? ''))
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  // Fetch the technical document
  const { data: techDoc } = await supabase
    .from('technical_documents')
    .select('*, projects(name, client, capacity_mw, stage)')
    .eq('id', techDocId)
    .single()

  if (!techDoc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  if (!techDoc.storage_path) return NextResponse.json({ error: 'No file attached to this document' }, { status: 400 })

  const projectId = techDoc.project_id

  // Create analysis record
  const { data: analysis } = await supabase.from('tech_doc_analyses').insert({
    tech_document_id: techDocId,
    project_id: projectId,
    status: 'running',
  }).select().single()

  if (!analysis) return NextResponse.json({ error: 'Failed to create analysis record' }, { status: 500 })

  // Fetch supporting context in parallel
  const [
    { data: designDocs },
    { data: lessons },
    { data: standards },
    { data: existingAnalyses },
  ] = await Promise.all([
    supabase.from('documents')
      .select('doc_no, title, rev, type')
      .eq('project_id', projectId)
      .order('doc_no'),
    supabase.from('project_lessons_learned')
      .select('lesson_id, lessons_learned(category, description, root_cause, recommendation)')
      .eq('project_id', projectId),
    supabase.from('project_standards')
      .select('standard_id, standards(ref, title, category)')
      .eq('project_id', projectId),
    supabase.from('tech_doc_analyses')
      .select('findings')
      .eq('project_id', projectId)
      .eq('status', 'complete')
      .neq('tech_document_id', techDocId)
      .limit(5),
  ])

  // Download and extract text from the PDF
  let docText = ''
  try {
    const { data: fileData, error: dlErr } = await supabase.storage
      .from('documents')
      .download(techDoc.storage_path)
    if (!dlErr && fileData) {
      if (techDoc.mime_type === 'application/pdf') {
        docText = await extractPdfText(fileData)
      }
    }
  } catch {
    // Continue with empty text — Claude can still analyse metadata
  }

  // Build context strings
  const lessonsList = (lessons ?? [])
    .map((r: any) => r.lessons_learned)
    .filter(Boolean)
    .map((l: any) => `- [${l.category}] ${l.description}${l.recommendation ? ` → ${l.recommendation}` : ''}`)
    .join('\n')

  const designDocsList = (designDocs ?? [])
    .map((d: any) => `${d.doc_no} Rev ${d.rev} — ${d.title} (${d.type})`)
    .join('\n')

  const standardsList = (standards ?? [])
    .map((r: any) => r.standards)
    .filter(Boolean)
    .map((s: any) => `${s.ref} — ${s.title}`)
    .join('\n')

  const prevFindingsText = (existingAnalyses ?? [])
    .flatMap((a: any) => (a.findings ?? []).slice(0, 3))
    .map((f: any) => `[${f.category}] ${f.title}: ${f.value_extracted ?? f.detail?.substring(0, 100)}`)
    .join('\n')

  const project = (techDoc as any).projects
  const projectContext = `Project: ${project?.name ?? 'Unknown'} | Client: ${project?.client ?? 'Unknown'} | Capacity: ${project?.capacity_mw ?? '?'} MW BESS | Stage: ${project?.stage ?? 'Unknown'}`

  const prompt = `You are a BESS (Battery Energy Storage System) technical reviewer for a UK construction project.

${projectContext}

DOCUMENT BEING ANALYSED:
Title: ${techDoc.title}
Source: ${techDoc.source}
Type: ${techDoc.doc_type}
Reference: ${techDoc.doc_ref ?? 'none'}
${techDoc.notes ? `Notes: ${techDoc.notes}` : ''}

DOCUMENT TEXT (extracted):
${docText ? docText.substring(0, 20000) : '[No extractable text — image-based PDF or no file]'}

PROJECT DESIGN DOCUMENTS (for cross-referencing):
${designDocsList || 'None registered'}

PROJECT STANDARDS:
${standardsList || 'None linked'}

LESSONS LEARNED LIBRARY:
${lessonsList || 'None linked'}

PREVIOUS TECHNICAL DOCUMENT FINDINGS (for context):
${prevFindingsText || 'None'}

TASK:
Review this document and extract findings in these categories:

1. **specification** — Key technical specifications, ratings, dimensions, or values stated in the document (e.g. cable sizes, IP ratings, fault current ratings, temperature ranges, torque values). Extract the actual value.

2. **compliance_check** — Any specification in this document that should be cross-checked against project design documents (e.g. manufacturer states 95mm² cable → does the design drawing also state 95mm²?). Flag discrepancies or confirm matches where visible.

3. **lessons_learned** — Anything in this document that relates to, confirms, or contradicts the lessons learned library entries.

4. **construction** — Notes relevant to installation, handling, sequencing, commissioning requirements, or constructability. Include lifting weights, crane requirements, foundation loads, clearances, access needs.

5. **safety** — H&S requirements, COSHH data, PTW requirements, exclusion zones, arc flash ratings, ATEX classifications stated in the document.

6. **general** — Anything else noteworthy (warranty conditions, lead times, certifications, approvals needed).

Return ONLY a JSON object with this structure — no prose before or after:
{
  "summary": "2-3 sentence summary of what this document is and its key relevance to the project",
  "findings": [
    {
      "category": "specification|compliance_check|lessons_learned|construction|safety|general",
      "severity": "High|Medium|Low|Information",
      "title": "Short title",
      "detail": "Full explanation",
      "value_extracted": "The specific value, rating, or figure (if applicable)",
      "cross_ref": "Reference to project design doc or lesson that should be checked (if applicable)",
      "page_ref": "Page or section number in this document (if known)"
    }
  ]
}`

  const anthropic = new Anthropic()

  let findings: TechFinding[] = []
  let summary = ''
  let errorMsg: string | null = null
  let modelUsed = 'claude-opus-4-8'

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlocks = response.content.filter(b => b.type === 'text').map(b => (b as any).text).join('')
    const parsed = extractAndParse(textBlocks)

    if (parsed && Array.isArray(parsed.findings)) {
      findings = parsed.findings
      summary = parsed.summary ?? ''
    }
  } catch (err: any) {
    errorMsg = err?.message ?? 'Analysis failed'
  }

  // Persist results
  const finalStatus = errorMsg ? 'error' : 'complete'
  await supabase.from('tech_doc_analyses').update({
    status: finalStatus,
    findings: findings.length > 0 ? findings : null,
    raw_summary: summary || null,
    error: errorMsg,
    model: modelUsed,
    completed_at: new Date().toISOString(),
  }).eq('id', analysis.id)

  if (errorMsg) return NextResponse.json({ error: errorMsg }, { status: 500 })

  return NextResponse.json({ analysisId: analysis.id, findingCount: findings.length, summary })
}
