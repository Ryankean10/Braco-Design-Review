import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { extractAndParse } from '@/lib/repairJson'
import { logApiUsage } from '@/lib/logApiUsage'

export const maxDuration = 300

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
  if (!['admin', 'superadmin', 'engineer'].includes(profile?.role ?? ''))
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const body = await req.json() as { runId: string }
  const { runId } = body
  if (!runId) return NextResponse.json({ error: 'runId required' }, { status: 400 })

  // Fetch run + project
  const [{ data: run }, { data: project }] = await Promise.all([
    supabase.from('design_review_runs').select('id, document_ids, lenses, status').eq('id', runId).eq('project_id', projectId).single(),
    supabase.from('projects').select('id, name, client, location, company_id').eq('id', projectId).single(),
  ])
  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Fetch findings for this run
  const { data: findings } = await supabase
    .from('design_findings')
    .select('id, lens, severity, title, description, clause_ref, drawing_refs, document_refs, status')
    .eq('run_id', runId)
    .order('severity')

  if (!findings?.length)
    return NextResponse.json({ error: 'No findings found for this run' }, { status: 400 })

  // Download and extract text from documents
  const { data: docs } = await supabase
    .from('documents')
    .select('id, doc_no, title, rev, storage_path')
    .in('id', run.document_ids ?? [])

  const docTexts: { doc_no: string; title: string; text: string }[] = []
  for (const doc of docs ?? []) {
    if (!doc.storage_path) continue
    try {
      const { data: fileData } = await supabase.storage.from('documents').download(doc.storage_path)
      if (!fileData) continue
      const text = await extractPdfText(fileData)
      if (text.trim().length > 50) {
        docTexts.push({ doc_no: doc.doc_no, title: doc.title, text: text.slice(0, 12000) })
      }
    } catch { /* skip unreadable docs */ }
  }

  const combinedDocText = docTexts.length
    ? docTexts.map(d => `=== ${d.doc_no} — ${d.title} ===\n${d.text}`).join('\n\n')
    : '(No readable document text available)'

  const findingsSummary = findings.map((f, i) =>
    `[${i + 1}] ID:${f.id} | ${f.severity} | ${f.lens} | ${f.title}\n    ${f.description}${f.clause_ref ? `\n    Clause: ${f.clause_ref}` : ''}`
  ).join('\n\n')

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

  const prompt = `You are a professional design review engineer producing a formal design review markup letter.

PROJECT: ${project.name}
CLIENT: ${project.client ?? '—'}
LOCATION: ${project.location ?? '—'}
DATE: ${today}
TOTAL FINDINGS: ${findings.length}

FINDINGS:
${findingsSummary}

DOCUMENT EXTRACTS:
${combinedDocText}

Your task:
1. For each finding (identified by its ID), find the most relevant 1–3 sentence passage from the document extracts that the finding relates to. If no relevant passage can be found, leave the quote empty ("").
2. Produce a complete, professional engineering design review letter as an HTML document. The letter should:
   - Have a clear header with project details, date, and review reference number
   - Include an executive summary of the overall findings
   - List all findings in a structured table: No., Severity, Category, Finding, Clause Ref, Action Required
   - Use professional engineering language
   - Be formatted cleanly with inline CSS (no external stylesheets) suitable for printing

Respond with valid JSON only (no markdown fences):
{
  "quotes": {
    "<finding_id>": "1–3 sentence excerpt from document text, or empty string if none found",
    ...one entry per finding id...
  },
  "markup_html": "<complete self-contained HTML document as a string>"
}`

  const client = new Anthropic()

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  })

  logApiUsage({
    companyId: project.company_id ?? null,
    endpoint: 'generate-markup',
    model: 'claude-sonnet-4-6',
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }).catch(() => {})

  const rawText = response.content[0]?.type === 'text' ? response.content[0].text : ''
  const parsed = extractAndParse<{ quotes: Record<string, string>; markup_html: string }>(rawText)

  if (!parsed?.markup_html)
    return NextResponse.json({ error: 'AI did not produce markup HTML' }, { status: 500 })

  const quotes = parsed.quotes ?? {}

  // Batch update quotes on findings
  const quoteUpdates = Object.entries(quotes)
    .filter(([, q]) => q?.trim())
    .map(([id, quote]) =>
      supabase.from('design_findings').update({ quote: quote.trim() }).eq('id', id)
    )
  await Promise.all(quoteUpdates)

  // Store markup HTML on the run
  await supabase
    .from('design_review_runs')
    .update({ markup_html: parsed.markup_html })
    .eq('id', runId)

  return NextResponse.json({ markup_html: parsed.markup_html, quotes })
}
