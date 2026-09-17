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
  try {
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

    const findingsSummary = findings.map((f: any, i: number) =>
      `[${i + 1}] ID:${f.id} | ${f.severity} | ${f.lens} | ${f.title}\n    ${f.description}${f.clause_ref ? `\n    Clause: ${f.clause_ref}` : ''}`
    ).join('\n\n')

    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    const projectName = (project as any).name
    const clientName = (project as any).client ?? '—'
    const location = (project as any).location ?? '—'
    const companyId = (project as any).company_id ?? null

    const client = new Anthropic()

    // ── Call 1: extract quotes only (small JSON, low token budget) ─────────────
    const quotesPrompt = `You are a professional design review engineer.

Given the following findings and document extracts, identify the most relevant 1–3 sentence passage from the documents that each finding relates to.

FINDINGS:
${findingsSummary}

DOCUMENT EXTRACTS:
${combinedDocText}

Respond with valid JSON only (no markdown fences):
{ "quotes": { "<finding_id>": "1–3 sentence excerpt from document text, or empty string if none found" } }`

    const quotesResponse = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{ role: 'user', content: quotesPrompt }],
    })

    logApiUsage({
      companyId,
      endpoint: 'generate-markup-quotes',
      model: 'claude-sonnet-4-6',
      inputTokens: quotesResponse.usage.input_tokens,
      outputTokens: quotesResponse.usage.output_tokens,
    }).catch(() => {})

    const quotesRaw = quotesResponse.content[0]?.type === 'text' ? quotesResponse.content[0].text : ''
    const quotesParsed = extractAndParse<{ quotes: Record<string, string> }>(quotesRaw)
    const quotes: Record<string, string> = quotesParsed?.quotes ?? {}

    // ── Call 2: generate HTML letter as raw text (no JSON wrapping) ────────────
    const htmlPrompt = `You are a professional design review engineer producing a formal design review markup letter.

PROJECT: ${projectName}
CLIENT: ${clientName}
LOCATION: ${location}
DATE: ${today}
TOTAL FINDINGS: ${findings.length}

FINDINGS:
${findingsSummary}

Produce a complete, professional engineering design review letter as a self-contained HTML document. Requirements:
- Clear header: project name, client, location, date, review reference (use REV-${new Date().getFullYear()}-001)
- Executive summary paragraph
- Findings table: columns for No., Severity, Category, Finding Title, Description, Clause Ref, Action Required
- Colour-code severity rows: Critical = #fee2e2, Major = #ffedd5, Minor = #fefce8, Observation = #f8fafc
- Professional engineering language and tone
- All CSS inline (no external stylesheets or fonts)
- Suitable for printing (A4)

Respond with the HTML document only. No JSON. No markdown fences. Begin your response with <!DOCTYPE html>.`

    const htmlResponse = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      messages: [{ role: 'user', content: htmlPrompt }],
    })

    logApiUsage({
      companyId,
      endpoint: 'generate-markup-html',
      model: 'claude-sonnet-4-6',
      inputTokens: htmlResponse.usage.input_tokens,
      outputTokens: htmlResponse.usage.output_tokens,
    }).catch(() => {})

    const rawHtml = htmlResponse.content[0]?.type === 'text' ? htmlResponse.content[0].text.trim() : ''

    if (!rawHtml.startsWith('<!DOCTYPE') && !rawHtml.startsWith('<html'))
      return NextResponse.json({ error: 'AI did not produce valid HTML — try again' }, { status: 500 })

    // Batch update quotes on findings
    const quoteUpdates = Object.entries(quotes)
      .filter(([, q]) => (q as string)?.trim())
      .map(([id, quote]) =>
        supabase.from('design_findings').update({ quote: (quote as string).trim() }).eq('id', id)
      )
    await Promise.all(quoteUpdates)

    // Store markup HTML on the run
    await supabase
      .from('design_review_runs')
      .update({ markup_html: rawHtml })
      .eq('id', runId)

    return NextResponse.json({ markup_html: rawHtml, quotes })

  } catch (e: any) {
    console.error('generate-markup error:', e)
    return NextResponse.json(
      { error: e?.message ?? 'Internal server error — please try again' },
      { status: 500 }
    )
  }
}
