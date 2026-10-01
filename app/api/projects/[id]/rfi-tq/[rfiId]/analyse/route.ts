import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { requireRole, INTERNAL_ROLES } from '@/lib/auth'
import { logApiUsage } from '@/lib/logApiUsage'

export const maxDuration = 120

async function extractPdfText(buf: Buffer): Promise<string> {
  const { createRequire } = await import('module')
  const require = createRequire(import.meta.url)
  const pdfParse = require('pdf-parse/lib/pdf-parse.js')
  const parsed = await pdfParse(buf)
  return parsed.text as string
}

function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? text.slice(0, maxChars) + '\n\n[... truncated ...]' : text
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; rfiId: string }> }) {
  const { id: projectId, rfiId } = await params
  const auth = await requireRole(INTERNAL_ROLES)
  if ('error' in auth) return auth.error

  const supabase = await createClient()

  // Load project (ER path) + RFI/TQ
  const [{ data: project }, { data: rfi }] = await Promise.all([
    supabase.from('projects').select('id, name, client, er_storage_path, er_file_name').eq('id', projectId).single(),
    supabase.from('rfis_tqs').select('*').eq('id', rfiId).eq('project_id', projectId).single(),
  ])

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (!rfi) return NextResponse.json({ error: 'RFI/TQ not found' }, { status: 404 })

  // ── Gather source documents ────────────────────────────────────────────────
  const sources: { label: string; text: string }[] = []

  // 1. ER document
  if (project.er_storage_path) {
    try {
      const { data: erFile } = await supabase.storage.from('documents').download(project.er_storage_path)
      if (erFile) {
        const buf = Buffer.from(await erFile.arrayBuffer())
        const raw = await extractPdfText(buf)
        sources.push({ label: `Employer's Requirements (${project.er_file_name ?? 'ER'})`, text: truncate(raw, 30000) })
      }
    } catch { /* skip if unreadable */ }
  }

  // 2. RFI/TQ-specific attachments (highest priority — most relevant)
  const { data: attachments } = await supabase
    .from('rfi_tq_attachments')
    .select('storage_path, file_name, mime_type')
    .eq('rfi_tq_id', rfiId)
    .order('uploaded_at')

  for (const att of attachments ?? []) {
    const isPdf = att.mime_type === 'application/pdf' || att.file_name.toLowerCase().endsWith('.pdf')
    if (!isPdf) continue
    try {
      const { data: file } = await supabase.storage.from('documents').download(att.storage_path)
      if (!file) continue
      const buf = Buffer.from(await file.arrayBuffer())
      const raw = await extractPdfText(buf)
      sources.push({ label: `[Attached] ${att.file_name}`, text: truncate(raw, 15000) })
    } catch { /* skip unreadable */ }
  }

  // 3. Project documents (PDFs only, up to 5, sorted newest first)
  const { data: docs } = await supabase
    .from('documents')
    .select('id, doc_no, title, storage_path, mime_type, file_name')
    .eq('project_id', projectId)
    .not('storage_path', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10)

  const pdfDocs = (docs ?? []).filter((d: any) => d.mime_type === 'application/pdf' || (d.file_name ?? '').toLowerCase().endsWith('.pdf'))

  for (const doc of pdfDocs.slice(0, 5)) {
    try {
      const { data: file } = await supabase.storage.from('documents').download((doc as any).storage_path)
      if (!file) continue
      const buf = Buffer.from(await file.arrayBuffer())
      const raw = await extractPdfText(buf)
      const label = [(doc as any).doc_no, (doc as any).title].filter(Boolean).join(' — ')
      sources.push({ label, text: truncate(raw, 10000) })
    } catch { /* skip unreadable */ }
  }

  const hasDocuments = sources.length > 0

  // ── Build prompt ──────────────────────────────────────────────────────────
  const rfiContent = [
    `Type: ${rfi.type}`,
    `Number: ${rfi.number}`,
    `Title: ${rfi.title}`,
    rfi.description ? `Query / Description:\n${rfi.description}` : '',
    rfi.proposed_solution ? `Contractor's Proposed Solution:\n${rfi.proposed_solution}` : '',
    rfi.cost_impact ? `Cost Impact: ${rfi.cost_impact}` : '',
    rfi.programme_impact ? `Programme Impact: ${rfi.programme_impact}` : '',
    rfi.is_scope_change ? 'Scope change: Yes' : '',
  ].filter(Boolean).join('\n\n')

  const docsBlock = hasDocuments
    ? sources.map((s, i) =>
        `=== DOCUMENT ${i + 1}: ${s.label} ===\n${s.text}`
      ).join('\n\n')
    : 'No documents available in the project library.'

  const prompt = `You are a senior UK construction and BESS (Battery Energy Storage System) engineer reviewing a Technical Query (TQ) or Request for Information (RFI) on behalf of the project team. Your job is to:

1. Search the provided project documents and Employer's Requirements for any clause, specification, drawing note, or requirement that directly answers or is relevant to the RFI/TQ.
2. If you find relevant information, quote it verbatim and explain how it answers the query.
3. Draft a professional suggested response that the engineer could send to the client.
4. If the documents do NOT contain a clear answer, say so honestly, then provide a reasoned technical analysis of what the expected answer or industry-standard approach should be, based on the nature of the query.

Respond ONLY with valid JSON in this exact structure:
{
  "found_in_documents": true | false,
  "confidence": "high" | "medium" | "low" | "none",
  "summary": "One sentence: what was or wasn't found",
  "sources": [
    {
      "document": "Document label",
      "clause_ref": "Section/clause reference if identifiable, or null",
      "verbatim_text": "Exact quoted text from the document",
      "relevance": "Why this is relevant to the query"
    }
  ],
  "technical_analysis": "Full technical analysis. If found in docs: explain how the clauses answer the query and any nuance. If not found: explain what the expected industry-standard answer is, what standards apply (e.g. BS 5489 for lighting, BS 7671 for electrical), and what the client is likely to expect. 2-5 paragraphs.",
  "suggested_response": "Draft response text ready to send to the client. Professional UK construction tone. Should directly answer the questions raised, reference any relevant clauses found, and be clear and concise. 3-6 sentences."
}

=== RFI/TQ DETAILS ===
${rfiContent}

=== PROJECT: ${project.name} | CLIENT: ${project.client ?? 'Unknown'} ===

=== PROJECT DOCUMENTS ===
${docsBlock}`

  // ── Call Claude (streaming → collect full response) ───────────────────────
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 3000,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: prompt }],
  })

  logApiUsage({
    companyId: null,
    endpoint: 'rfi-tq-analyse',
    model: message.model,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  }).catch(() => {})

  const responseText = message.content.find(b => b.type === 'text')?.text ?? ''

  let result: any
  try {
    // Strip markdown code fences if present
    const clean = responseText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
    result = JSON.parse(clean)
  } catch {
    // Try to extract JSON from the response
    const match = responseText.match(/\{[\s\S]*\}/)
    if (match) {
      try { result = JSON.parse(match[0]) } catch {
        return NextResponse.json({ error: 'Could not parse AI response', raw: responseText }, { status: 500 })
      }
    } else {
      return NextResponse.json({ error: 'No JSON in AI response', raw: responseText }, { status: 500 })
    }
  }

  // Persist result on the RFI/TQ row
  await supabase.from('rfis_tqs').update({
    ai_analysis: result,
    ai_analysed_at: new Date().toISOString(),
  }).eq('id', rfiId)

  return NextResponse.json({
    ...result,
    docs_searched: sources.length,
    doc_labels: sources.map(s => s.label),
  })
}
