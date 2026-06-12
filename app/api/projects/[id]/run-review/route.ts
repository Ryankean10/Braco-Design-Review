import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { extractAndParse } from '@/lib/repairJson'

export const maxDuration = 300

type Lens = 'er_compliance' | 'standards' | 'constructability' | 'procurement' | 'clash'

const LENS_LABELS: Record<Lens, string> = {
  er_compliance:    'ER Compliance',
  standards:        'Standards',
  constructability: 'Constructability',
  procurement:      'Procurement Linkage',
  clash:            'Clash Detection',
}

interface FindingRaw {
  severity: string
  title: string
  description: string
  clause_ref?: string
  drawing_refs?: string[]
  document_refs?: string[]
  procurement_item_id?: string | null
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
  const { id: projectId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'engineer'].includes(profile?.role ?? ''))
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const body = await req.json() as { lenses: Lens[]; documentIds: string[] }
  const { lenses, documentIds } = body

  if (!lenses?.length || !documentIds?.length)
    return NextResponse.json({ error: 'lenses and documentIds required' }, { status: 400 })

  // ── Create run record ──────────────────────────────────────────────────────
  const { data: run, error: runErr } = await supabase
    .from('design_review_runs')
    .insert({
      project_id: projectId,
      run_by: user.id,
      document_ids: documentIds,
      lenses,
      status: 'running',
    })
    .select('id')
    .single()

  if (runErr) return NextResponse.json({ error: runErr.message }, { status: 500 })
  const runId = run.id

  // ── Load project ───────────────────────────────────────────────────────────
  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single()
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // ── Download & extract design documents ───────────────────────────────────
  const { data: docs } = await supabase
    .from('documents')
    .select('id, doc_no, title, rev, type, storage_path')
    .in('id', documentIds)

  const docTexts: { doc_no: string; title: string; text: string }[] = []
  const failedDocs: string[] = []

  for (const doc of docs ?? []) {
    try {
      const { data: fileData } = await supabase.storage.from('documents').download(doc.storage_path)
      if (!fileData) { failedDocs.push(doc.doc_no); continue }
      const text = await extractPdfText(fileData)
      if (text.trim().length < 50) {
        failedDocs.push(`${doc.doc_no} (no readable text — may be a scanned image PDF)`)
        continue
      }
      docTexts.push({ doc_no: doc.doc_no, title: doc.title, text: text.slice(0, 15000) })
    } catch {
      failedDocs.push(doc.doc_no)
    }
  }

  if (!docTexts.length) {
    const msg = `Could not extract text from ${failedDocs.length ? failedDocs.join(', ') : 'any selected document'}. Ensure PDFs contain selectable text (not scanned images — try re-exporting from your CAD/design tool as a searchable PDF).`
    await supabase.from('design_review_runs').update({ status: 'failed', error: msg }).eq('id', runId)
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // Store partial extraction warnings in the run record now (survive page reload)
  if (failedDocs.length) {
    await supabase.from('design_review_runs').update({
      error: `Partial extraction: could not read text from — ${failedDocs.join('; ')}. Review above was conducted on the remaining documents only.`,
    }).eq('id', runId)
  }

  const combinedDocText = docTexts.map(d =>
    `=== DOCUMENT: ${d.doc_no} — ${d.title} ===\n${d.text}`
  ).join('\n\n')

  const docList = (docs ?? []).map(d => `${d.doc_no} — ${d.title} Rev ${d.rev}`).join('\n')

  // ── Build context sections for requested lenses ────────────────────────────
  const contextSections: string[] = []

  if (lenses.includes('er_compliance')) {
    let erText = '(No ER document uploaded for this project)'
    if (project.er_storage_path) {
      try {
        const { data: erFile } = await supabase.storage.from('documents').download(project.er_storage_path)
        if (erFile) {
          const t = await extractPdfText(erFile)
          erText = t.trim().length > 50 ? t.slice(0, 25000) : '(ER document could not be parsed — may be a scanned image)'
        }
      } catch { /* leave default */ }
    }
    contextSections.push(`EMPLOYER'S REQUIREMENTS (for er_compliance lens):\n${erText}`)
  }

  if (lenses.includes('standards')) {
    const { data: linked } = await supabase
      .from('project_standards')
      .select('standard_id, standards(ref, title, category, summary)')
      .eq('project_id', projectId)
    const list = (linked ?? []).map((ps: any) => {
      const s = ps.standards
      return `${s.ref} — ${s.title} (${s.category})${s.summary ? ': ' + s.summary.slice(0, 120) : ''}`
    }).join('\n')
    contextSections.push(`LINKED STANDARDS LIBRARY (for standards lens):\n${list || '(No standards linked to this project)'}`)
  }

  if (lenses.includes('constructability') || lenses.includes('clash')) {
    const { data: lessons } = await supabase
      .from('lessons_learned').select('title, description, category, severity').limit(40)
    const list = (lessons ?? []).map((l: any) =>
      `[${l.severity ?? 'Note'}] ${l.category ?? ''}: ${l.title} — ${l.description}`
    ).join('\n')
    contextSections.push(`LESSONS LEARNED LIBRARY (for constructability and clash lenses):\n${list || '(No lessons learned in library)'}`)
  }

  if (lenses.includes('procurement')) {
    const { data: items } = await supabase
      .from('procurement_items')
      .select('id, title, description, category, estimated_lead_weeks, status, notes')
      .eq('project_id', projectId)
    const list = (items ?? []).map((p: any) =>
      `ID:${p.id} | ${p.title} (${p.category}) | Lead: ${p.estimated_lead_weeks ?? '?'} wks | Status: ${p.status ?? 'Not ordered'}`
    ).join('\n')
    contextSections.push(`PROCUREMENT REGISTER (for procurement lens):\n${list || '(Empty procurement register)'}`)
  }

  // ── Build lens instructions ────────────────────────────────────────────────
  const lensInstructions: string[] = []

  if (lenses.includes('er_compliance')) lensInstructions.push(`
"er_compliance": Review the design documents against the Employer's Requirements above. Identify every non-conformance, gap, or area requiring clarification. Quote the specific ER clause in clause_ref. Drawing reference is mandatory.`)

  if (lenses.includes('standards')) lensInstructions.push(`
"standards": Check the design against the linked standards library. Flag: (1) standards not met by the design, (2) standards referenced in the design but absent from the library. Quote the specific clause in clause_ref.`)

  if (lenses.includes('constructability')) lensInstructions.push(`
"constructability": Identify construction risks: access for plant/personnel, sequencing constraints, interface risks, temporary works gaps, buildability issues, likely rework scenarios. Reference lessons learned where applicable.`)

  if (lenses.includes('procurement')) lensInstructions.push(`
"procurement": Link design-specified equipment to the procurement register. Flag: spec mismatches, items not on the register, vague specifications, lead-time risks. Include procurement_item_id (the UUID) for matched items.`)

  if (lenses.includes('clash')) lensInstructions.push(`
"clash": Identify physical and compliance clashes across ALL documents: ducting vs drainage, buried services vs foundations, earthing conflicts, above-ground clearances, cross-document contradictions, interface gaps between packages. Reference both clashing documents.`)

  // ── Single Claude call for all lenses ─────────────────────────────────────
  const systemPrompt = `You are a senior UK BESS engineering reviewer. Conduct a thorough multi-lens design review. Be specific and technical. Every finding must include at least one drawing_ref or document_ref — do not raise a finding without a reference. Severity: Critical = safety/legal/grid connection risk; Major = significant design flaw; Minor = improvement needed; Observation = advisory note.`

  const userPrompt = `Review the following design documents across ${lenses.length} lens${lenses.length > 1 ? 'es' : ''}.

AVAILABLE DOCUMENTS:
${docList}${failedDocs.length ? `\n\nWARNING — could not extract text from: ${failedDocs.join(', ')}` : ''}

${contextSections.join('\n\n')}

DESIGN DOCUMENTS:
${combinedDocText}

LENS INSTRUCTIONS:
${lensInstructions.join('\n')}

Return ONLY valid JSON — no preamble, no markdown fences. Structure:
{
${lenses.map(l => `  "${l}": [
    {
      "severity": "Critical|Major|Minor|Observation",
      "title": "Short title",
      "description": "Detailed description quoting relevant clauses and explaining the consequence",
      "clause_ref": "Document/standard clause reference",
      "drawing_refs": ["DOC-001"],
      "document_refs": ["ER Section 4"],
      "procurement_item_id": null
    }
  ]`).join(',\n')}
}`

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let responseText = ''
  let stopReason = ''
  try {
    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 32000,
      thinking: { type: 'adaptive' },
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })
    const msg = await stream.finalMessage()
    responseText = msg.content.find(b => b.type === 'text')?.text ?? ''
    stopReason = msg.stop_reason ?? ''
    console.log('[run-review] stop_reason:', stopReason, '| text length:', responseText.length, '| preview:', responseText.slice(0, 200))
  } catch (e: any) {
    await supabase.from('design_review_runs').update({ status: 'failed', error: e.message }).eq('id', runId)
    return NextResponse.json({ error: `Claude API error: ${e.message}` }, { status: 500 })
  }

  // ── Parse response ─────────────────────────────────────────────────────────
  let parsed: Partial<Record<Lens, FindingRaw[]>> = {}
  try {
    parsed = extractAndParse(responseText)
    console.log('[run-review] parsed lens counts:', Object.fromEntries(lenses.map(l => [l, Array.isArray(parsed[l]) ? parsed[l]!.length : 'missing'])))
    for (const lens of lenses) {
      if (!Array.isArray(parsed[lens])) parsed[lens] = []
    }
  } catch (e: any) {
    console.error('[run-review] parse error:', e.message, '| raw:', responseText.slice(0, 500))
    await supabase.from('design_review_runs').update({ status: 'failed', error: `Parse error: ${e.message}. Raw (first 500): ${responseText.slice(0, 500)}` }).eq('id', runId)
    return NextResponse.json({ error: `Failed to parse findings: ${e.message}` }, { status: 500 })
  }

  // ── Insert findings ────────────────────────────────────────────────────────
  const VALID_SEV = ['Critical', 'Major', 'Minor', 'Observation']
  const allRows: any[] = []

  for (const lens of lenses) {
    const findings = parsed[lens] ?? []
    for (const f of findings) {
      if (!f.title?.trim() || !f.description?.trim()) continue
      allRows.push({
        run_id: runId,
        project_id: projectId,
        lens,
        severity: VALID_SEV.includes(f.severity) ? f.severity : 'Minor',
        title: f.title.trim(),
        description: f.description.trim(),
        clause_ref: f.clause_ref?.trim() ?? null,
        drawing_refs: Array.isArray(f.drawing_refs) ? f.drawing_refs : [],
        document_refs: Array.isArray(f.document_refs) ? f.document_refs : [],
        procurement_item_id: f.procurement_item_id ?? null,
        status: 'Pending',
      })
    }
  }

  // Inject a persistent warning finding for any unreadable documents
  if (failedDocs.length) {
    allRows.unshift({
      run_id: runId,
      project_id: projectId,
      lens: 'er_compliance',
      severity: 'Major',
      title: `Document extraction failed — ${failedDocs.length} file${failedDocs.length > 1 ? 's' : ''} not reviewed`,
      description: `The following documents could not be text-extracted and were EXCLUDED from this review: ${failedDocs.join('; ')}. These are likely scanned image PDFs. Re-export as searchable PDFs (with OCR or from the original CAD/design tool) and re-run the review to cover them. Until then, findings from these documents are missing from the log.`,
      clause_ref: 'Document Quality — Searchable PDF Required',
      drawing_refs: failedDocs.map(d => d.split(' (')[0]),
      document_refs: [],
      procurement_item_id: null,
      status: 'Pending',
    })
  }

  let insertedFindings: any[] = []
  if (allRows.length) {
    const { data: ins, error: insertErr } = await supabase
      .from('design_findings').insert(allRows).select('id, lens, severity, title')
    if (insertErr) {
      await supabase.from('design_review_runs').update({ status: 'failed', error: insertErr.message }).eq('id', runId)
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }
    insertedFindings = ins ?? []

    // Log every finding as "Raised"
    if (insertedFindings.length) {
      await supabase.from('design_decision_log').insert(
        insertedFindings.map((f: any) => ({
          finding_id: f.id,
          project_id: projectId,
          run_id: runId,
          lens: f.lens,
          finding_title: f.title,
          severity: f.severity,
          action: 'Raised',
          comment: `Raised by AI review (${LENS_LABELS[f.lens as Lens] ?? f.lens})`,
          actioned_by: user.id,
        }))
      )
    }
  }

  // If nothing came back, store the raw response to aid debugging
  const noFindings = insertedFindings.length === 0 && !failedDocs.length
  await supabase.from('design_review_runs').update({
    status: 'ai_complete',
    ...(noFindings ? { error: `AI returned 0 findings. stop_reason=${stopReason} | Raw (first 800): ${responseText.slice(0, 800)}` } : {}),
  }).eq('id', runId)

  return NextResponse.json({
    runId,
    findingCount: insertedFindings.length,
    byLens: lenses.reduce<Record<string, number>>((acc, l) => {
      acc[l] = insertedFindings.filter((f: any) => f.lens === l).length
      return acc
    }, {}),
    warnings: failedDocs.length ? [`Could not extract text from: ${failedDocs.join(', ')}`] : [],
  })
}
