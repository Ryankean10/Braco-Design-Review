import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireRole, INTERNAL_ROLES } from '@/lib/auth'
import { logApiUsage } from '@/lib/logApiUsage'

export const maxDuration = 60

async function extractText(buf: Buffer, mimeType: string, fileName: string): Promise<string> {
  const isPdf = mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')
  const isDocx = mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || fileName.toLowerCase().endsWith('.docx')
  const isDoc = mimeType === 'application/msword' || fileName.toLowerCase().endsWith('.doc')

  if (isPdf) {
    const { createRequire } = await import('module')
    const require = createRequire(import.meta.url)
    const pdfParse = require('pdf-parse/lib/pdf-parse.js')
    const parsed = await pdfParse(buf)
    return parsed.text as string
  }

  if (isDocx || isDoc) {
    const { createRequire } = await import('module')
    const require = createRequire(import.meta.url)
    const mammoth = require('mammoth')
    const result = await mammoth.extractRawText({ buffer: buf })
    return result.value as string
  }

  throw new Error(`Unsupported file type: ${mimeType || fileName}. Upload a PDF or DOCX.`)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const auth = await requireRole(INTERNAL_ROLES)
  if ('error' in auth) return auth.error

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  let rawText: string
  try {
    const buf = Buffer.from(await file.arrayBuffer())
    rawText = await extractText(buf, file.type, file.name)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 422 })
  }

  if (!rawText.trim()) {
    return NextResponse.json({ error: 'Could not extract any text from the document' }, { status: 422 })
  }

  const truncated = rawText.length > 20000 ? rawText.slice(0, 20000) + '\n\n[truncated]' : rawText

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `You are parsing a UK construction Technical Query (TQ) or Request for Information (RFI) document. Extract all available fields and return ONLY valid JSON — no markdown, no explanation.

The document may use Part 1 / Part 2 / Part 3 / Part 4 structure, or a freeform layout. Do your best to extract each field.

For dates, output ISO format (YYYY-MM-DD) or null if not found or unclear.
For text fields, clean up whitespace but preserve meaning. Return null for missing fields.
For possible_solutions, extract each row from Part 2 as an array item.

Return this JSON structure exactly:
{
  "type": "TQ" or "RFI",
  "number": "document reference number e.g. SHAPE-KILW-TQ-005",
  "title": "short descriptive title of the query",
  "to_contact": "recipient name(s)",
  "from_contact": "sender name(s)",
  "contractor_name": "contractor company name",
  "date_sent": "YYYY-MM-DD or null",
  "date_received": "YYYY-MM-DD or null",
  "document_reference": "referenced document identifier",
  "document_title": "title of the referenced document",
  "description": "full query/question text from Part 1 — preserve all numbered questions",
  "possible_solutions": [
    { "solution": "solution text", "cost_impact": "cost impact", "programme_impact": "programme impact" }
  ],
  "proposed_solution": "contractor proposed solution text from Part 3",
  "cost_impact": "estimated cost impact from Part 3",
  "programme_impact": "estimated programme impact from Part 3",
  "is_scope_change": true or false,
  "response_required_by": "YYYY-MM-DD or null"
}

DOCUMENT TEXT:
${truncated}`
    }]
  })

  logApiUsage({
    companyId: null,
    endpoint: 'rfi-tq-extract',
    model: message.model,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  }).catch(() => {})

  const responseText = message.content.find(b => b.type === 'text')?.text ?? ''

  let extracted: any
  try {
    const clean = responseText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
    extracted = JSON.parse(clean)
  } catch {
    const match = responseText.match(/\{[\s\S]*\}/)
    if (match) {
      try { extracted = JSON.parse(match[0]) }
      catch { return NextResponse.json({ error: 'Could not parse AI response', raw: responseText }, { status: 500 }) }
    } else {
      return NextResponse.json({ error: 'No JSON in AI response', raw: responseText }, { status: 500 })
    }
  }

  return NextResponse.json({ extracted, file_name: file.name })
}
