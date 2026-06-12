import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { extractAndParse } from '@/lib/repairJson'

export const maxDuration = 120

type Lens = 'er_compliance' | 'standards' | 'constructability' | 'procurement' | 'clash'

const LENSES_LABELS: Record<Lens, string> = {
  er_compliance:    "ER Compliance",
  standards:        "Standards",
  constructability: "Constructability",
  procurement:      "Procurement Linkage",
  clash:            "Clash Detection",
}

interface FindingRaw {
  severity: string
  title: string
  description: string
  clause_ref?: string
  drawing_refs?: string[]
  document_refs?: string[]
  procurement_item_id?: string
}

async function extractPdfText(fileData: Blob): Promise<string> {
  const buf = Buffer.from(await fileData.arrayBuffer())
  const { createRequire } = await import('module')
  const require = createRequire(import.meta.url)
  const pdfParse = require('pdf-parse/lib/pdf-parse.js')
  const parsed = await pdfParse(buf)
  return parsed.text as string
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'project_manager', 'engineer'].includes(profile?.role ?? ''))
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const body = await req.json() as { lens: Lens; documentIds: string[]; runId?: string }
  const { lens, documentIds, runId: existingRunId } = body

  if (!lens || !documentIds?.length)
    return NextResponse.json({ error: 'lens and documentIds required' }, { status: 400 })

  // ── Create or reuse run record ─────────────────────────────────────────────
  let runId = existingRunId
  if (!runId) {
    const { data: run, error: runErr } = await supabase
      .from('design_review_runs')
      .insert({
        project_id: projectId,
        run_by: user.id,
        document_ids: documentIds,
        lenses: [lens],
        status: 'running',
      })
      .select('id')
      .single()
    if (runErr) return NextResponse.json({ error: runErr.message }, { status: 500 })
    runId = run.id
  } else {
    // Append lens to existing run's lenses array
    const { data: existing } = await supabase.from('design_review_runs').select('lenses').eq('id', runId).single()
    const updatedLenses = [...(existing?.lenses ?? []), lens]
    await supabase.from('design_review_runs').update({ lenses: updatedLenses, status: 'running' }).eq('id', runId)
  }

  // ── Load project ───────────────────────────────────────────────────────────
  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single()
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // ── Download & extract selected design documents ───────────────────────────
  const { data: docs } = await supabase
    .from('documents')
    .select('id, doc_no, title, rev, type, storage_path, file_name')
    .in('id', documentIds)

  const docTexts: { doc_no: string; title: string; text: string }[] = []
  for (const doc of docs ?? []) {
    try {
      const { data: fileData } = await supabase.storage.from('documents').download(doc.storage_path)
      if (!fileData) continue
      const text = await extractPdfText(fileData)
      docTexts.push({ doc_no: doc.doc_no, title: doc.title, text: text.slice(0, 20000) })
    } catch {
      // Skip documents that can't be parsed
    }
  }

  if (!docTexts.length)
    return NextResponse.json({ error: 'No document text could be extracted' }, { status: 400 })

  const combinedDocText = docTexts.map(d =>
    `=== DOCUMENT: ${d.doc_no} — ${d.title} ===\n${d.text}`
  ).join('\n\n')

  const docList = (docs ?? []).map(d => `${d.doc_no} — ${d.title} Rev ${d.rev}`).join('\n')

  // ── Build lens-specific prompt ─────────────────────────────────────────────
  let systemPrompt = `You are a senior UK BESS (Battery Energy Storage System) engineering reviewer with expertise in UK regulations, DNO requirements (G99 Issue 2), and NESO Grid Code. You are conducting a formal design review. Be thorough and specific. Every finding must include a drawing or document reference.`

  let userPrompt = ''

  if (lens === 'er_compliance') {
    let erText = ''
    if (project.er_storage_path) {
      try {
        const { data: erFile } = await supabase.storage.from('documents').download(project.er_storage_path)
        if (erFile) erText = (await extractPdfText(erFile)).slice(0, 30000)
      } catch { /* skip */ }
    }

    userPrompt = `Review the following design documents against the Employer's Requirements (ER) and identify all non-conformances, gaps, and areas requiring clarification.

AVAILABLE DOCUMENTS:
${docList}

EMPLOYER'S REQUIREMENTS:
${erText || '(No ER document uploaded — flag this as a Critical finding)'}

DESIGN DOCUMENTS:
${combinedDocText}

Return ONLY valid JSON:
{
  "findings": [
    {
      "severity": "Critical|Major|Minor|Observation",
      "title": "Short descriptive title",
      "description": "Detailed description of the non-conformance. Quote the relevant ER clause verbatim where possible.",
      "clause_ref": "ER section/clause reference e.g. 'ER Section 4.2.1'",
      "drawing_refs": ["DOC-001", "DWG-003"],
      "document_refs": ["ER Section 4"]
    }
  ]
}`
  }

  else if (lens === 'standards') {
    const { data: linkedStandards } = await supabase
      .from('project_standards')
      .select('standard_id, standards(ref, title, category, summary)')
      .eq('project_id', projectId)

    const standardsList = (linkedStandards ?? []).map((ps: any) => {
      const s = ps.standards
      return `${s.ref} — ${s.title} (${s.category})${s.summary ? ': ' + s.summary : ''}`
    }).join('\n')

    userPrompt = `Review the following design documents against the linked standards library. Identify non-conformances with specific standards, clauses not met, and any standards referenced in the design that are NOT in the library below (flag these as gaps requiring library update).

AVAILABLE DOCUMENTS:
${docList}

LINKED STANDARDS LIBRARY:
${standardsList || '(No standards linked to this project yet — flag as Major finding)'}

DESIGN DOCUMENTS:
${combinedDocText}

Return ONLY valid JSON:
{
  "findings": [
    {
      "severity": "Critical|Major|Minor|Observation",
      "title": "Short descriptive title",
      "description": "Detailed description. Quote the specific standard clause that is not met or is missing from the library.",
      "clause_ref": "Standard ref and clause e.g. 'BS EN 62477-1 Clause 5.3.2'",
      "drawing_refs": ["DOC-001"],
      "document_refs": ["BS EN 62477-1"]
    }
  ]
}`
  }

  else if (lens === 'constructability') {
    const { data: lessons } = await supabase
      .from('lessons_learned')
      .select('title, description, category, severity')
      .limit(50)

    const lessonsList = (lessons ?? []).map((l: any) =>
      `[${l.severity ?? 'Note'}] ${l.category ?? ''}: ${l.title} — ${l.description}`
    ).join('\n')

    userPrompt = `Review the following design documents for constructability issues. Consider: access for plant and personnel, sequencing constraints, interface risks between packages, temporary works requirements, buildability of specified details, and likely rework scenarios. Cross-reference with the lessons-learned library.

AVAILABLE DOCUMENTS:
${docList}

LESSONS LEARNED LIBRARY:
${lessonsList || '(No lessons learned in library)'}

DESIGN DOCUMENTS:
${combinedDocText}

Return ONLY valid JSON:
{
  "findings": [
    {
      "severity": "Critical|Major|Minor|Observation",
      "title": "Short descriptive title",
      "description": "Describe the constructability issue clearly, including what will go wrong, the likely consequence, and what should be done differently. Reference any applicable lesson learned.",
      "clause_ref": "Relevant lesson reference or design clause",
      "drawing_refs": ["DWG-001"],
      "document_refs": ["DOC-002"]
    }
  ]
}`
  }

  else if (lens === 'procurement') {
    const { data: procItems } = await supabase
      .from('procurement_items')
      .select('id, title, description, category, estimated_lead_weeks, status, notes')
      .eq('project_id', projectId)

    const procList = (procItems ?? []).map((p: any) =>
      `ID:${p.id} | ${p.title} (${p.category}) | Lead: ${p.estimated_lead_weeks ?? '?'} wks | Status: ${p.status ?? 'Not ordered'} | ${p.notes ?? ''}`
    ).join('\n')

    userPrompt = `Review the following design documents against the procurement register. Identify:
1. Equipment/materials specified in the design that are already on the procurement register — flag any specification mismatches
2. Equipment/materials specified in the design that are NOT on the procurement register — these are procurement gaps
3. Long-lead items where design decisions may constrain the procurement programme
4. Design specifications that are too vague to procure against

AVAILABLE DOCUMENTS:
${docList}

PROCUREMENT REGISTER:
${procList || '(Empty procurement register)'}

DESIGN DOCUMENTS:
${combinedDocText}

Return ONLY valid JSON. For findings linked to a procurement item include its ID:
{
  "findings": [
    {
      "severity": "Critical|Major|Minor|Observation",
      "title": "Short descriptive title",
      "description": "Describe the procurement risk or gap clearly. For mismatches quote both the design spec and the procurement item spec.",
      "clause_ref": "Design document clause or section reference",
      "drawing_refs": ["DOC-001"],
      "document_refs": ["Procurement Register"],
      "procurement_item_id": "uuid-of-matched-item-or-null"
    }
  ]
}`
  }

  else if (lens === 'clash') {
    const { data: lessons } = await supabase
      .from('lessons_learned')
      .select('title, description, category')
      .limit(30)

    const lessonsList = (lessons ?? []).map((l: any) =>
      `${l.category ?? ''}: ${l.title} — ${l.description}`
    ).join('\n')

    userPrompt = `Perform a comprehensive clash detection review across all provided design documents. Identify:
1. Physical clashes: ducting vs drainage, underground services vs foundations/ground beams, above-ground connections interfering with access routes, earthing electrode positions conflicting with other buried services
2. Compliance clashes: where design decisions in one document create a compliance problem defined in another (e.g. cable routes that violate separation requirements, earthing that conflicts with protection settings)
3. Cross-document contradictions: where two documents specify conflicting requirements for the same element
4. Interface gaps: where two packages share an interface but neither document adequately defines it

Reference the lessons-learned library for known clash types on BESS sites.

AVAILABLE DOCUMENTS:
${docList}

LESSONS LEARNED:
${lessonsList || '(No lessons learned in library)'}

ALL DESIGN DOCUMENTS:
${combinedDocText}

Return ONLY valid JSON:
{
  "findings": [
    {
      "severity": "Critical|Major|Minor|Observation",
      "title": "Short descriptive title",
      "description": "Describe the clash clearly: what clashes with what, where on site, what the consequence is if not resolved, and what action is required.",
      "clause_ref": "Document/drawing reference where clash originates",
      "drawing_refs": ["DWG-001", "DWG-002"],
      "document_refs": ["DOC-003", "DOC-004"]
    }
  ]
}`
  }

  // ── Call Claude ────────────────────────────────────────────────────────────
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let responseText = ''
  try {
    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 8192,
      thinking: { type: 'adaptive' },
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })
    const msg = await stream.finalMessage()
    responseText = msg.content.find(b => b.type === 'text')?.text ?? ''
  } catch (e: any) {
    await supabase.from('design_review_runs').update({ status: 'failed', error: e.message }).eq('id', runId)
    return NextResponse.json({ error: `Claude API error: ${e.message}` }, { status: 500 })
  }

  // ── Parse and insert findings ──────────────────────────────────────────────
  let findings: FindingRaw[] = []
  try {
    const parsed = extractAndParse<{ findings: FindingRaw[] }>(responseText)
    findings = Array.isArray(parsed.findings) ? parsed.findings : []
  } catch (e: any) {
    await supabase.from('design_review_runs').update({ status: 'failed', error: `Parse error: ${e.message}` }).eq('id', runId)
    return NextResponse.json({ error: `Failed to parse findings: ${e.message}` }, { status: 500 })
  }

  const VALID_SEVERITIES = ['Critical', 'Major', 'Minor', 'Observation']
  const rows = findings
    .filter(f => f.title && f.description)
    .map(f => ({
      run_id: runId,
      project_id: projectId,
      lens,
      severity: VALID_SEVERITIES.includes(f.severity) ? f.severity : 'Minor',
      title: f.title,
      description: f.description,
      clause_ref: f.clause_ref ?? null,
      drawing_refs: Array.isArray(f.drawing_refs) ? f.drawing_refs : [],
      document_refs: Array.isArray(f.document_refs) ? f.document_refs : [],
      procurement_item_id: f.procurement_item_id ?? null,
      status: 'Pending',
    }))

  if (rows.length) {
    const { data: inserted, error: insertErr } = await supabase
      .from('design_findings')
      .insert(rows)
      .select('id, lens, severity, title')
    if (insertErr) {
      await supabase.from('design_review_runs').update({ status: 'failed', error: insertErr.message }).eq('id', runId)
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    // Auto-log every finding as "Raised" in the decision log
    if (inserted?.length) {
      const logRows = inserted.map((f: any) => ({
        finding_id: f.id,
        project_id: projectId,
        run_id: runId,
        lens: f.lens,
        finding_title: f.title,
        severity: f.severity,
        action: 'Raised',
        comment: `Raised by AI review (${LENSES_LABELS[lens as Lens] ?? lens})`,
        actioned_by: user.id,
      }))
      await supabase.from('design_decision_log').insert(logRows)
    }
  }

  // Mark run complete
  await supabase.from('design_review_runs').update({ status: 'complete' }).eq('id', runId)

  return NextResponse.json({ runId, findingCount: rows.length })
}
