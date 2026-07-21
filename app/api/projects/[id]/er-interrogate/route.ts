import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireRole, INTERNAL_ROLES } from '@/lib/auth'

export const maxDuration = 90

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const auth = await requireRole(INTERNAL_ROLES)
  if ('error' in auth) return auth.error

  const { question } = await req.json()
  if (!question?.trim()) return NextResponse.json({ error: 'No question provided' }, { status: 400 })

  const supabase = await createClient()

  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single()
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (!project.er_storage_path) return NextResponse.json({ error: 'No ER document uploaded' }, { status: 400 })

  const { data: fileData, error: storageErr } = await supabase.storage
    .from('documents')
    .download(project.er_storage_path)

  if (storageErr || !fileData) {
    return NextResponse.json({ error: `Storage error: ${storageErr?.message}` }, { status: 500 })
  }

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

  const erTextTruncated = erText.length > 60000
    ? erText.slice(0, 60000) + '\n\n[... document truncated ...]'
    : erText

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `You are a commercial specialist for a UK BESS contractor working on a design & build contract. You are reviewing the Employer's Requirements (ER) document on behalf of the contractor with a COMMERCIAL BIAS.

Your role when answering questions:
- Look for clauses that support the argument that something is NOT required under the ER (potential variation order)
- Note where the ER uses "should" vs "shall" — "should" is advisory, "shall" is mandatory
- Identify where the ER is SILENT on a matter — silence = not included in scope = potential variation
- Identify scope limitations or exclusions that support the contractor's position
- Only acknowledge that something IS required if the ER clearly and unambiguously mandates it
- Always quote the exact verbatim clause text when referencing the ER — do not paraphrase

QUESTION FROM THE ENGINEERING TEAM:
${question}

Analyse the ER document below and respond in ONLY valid JSON, no other text:

{
  "position": "NOT_REQUIRED" | "REQUIRED" | "AMBIGUOUS" | "NOT_COVERED" | "PARTIALLY_REQUIRED",
  "position_label": "Brief label e.g. 'Not in scope', 'Mandatory under ER', 'Ambiguous — argue discretionary', 'Silent — variation opportunity', 'Partially specified'",
  "summary": "One-sentence commercial summary of the position",
  "clauses": [
    {
      "ref": "Section or clause reference e.g. 'Section 4.3' or 'Clause 2.1.4'",
      "text": "Exact verbatim text from the ER document",
      "significance": "Why this clause supports the commercial position (1 sentence)"
    }
  ],
  "argument": "Full commercial argument text. Be specific, reference clause numbers. 2-4 paragraphs. If required, acknowledge it honestly and explain what a variation argument might still look like (e.g. scope of works, specification method). If not covered or not required, make the strongest possible legitimate argument.",
  "suggested_response": "Draft reply text the engineer could send to the client/employer or use in a commercial communication. Professional UK construction tone. 2-4 sentences."
}

If the ER is genuinely silent and contains no relevant clauses, set "clauses" to an empty array and explain that in the argument.

EMPLOYER'S REQUIREMENTS DOCUMENT — PROJECT: ${project.name ?? projectId}
${erTextTruncated}`
    }]
  })

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

  let result: any
  try {
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    result = JSON.parse(cleaned)
  } catch {
    const match = responseText.match(/\{[\s\S]*\}/)
    if (match) {
      try { result = JSON.parse(match[0]) } catch {
        return NextResponse.json({ error: 'Could not parse AI response' }, { status: 500 })
      }
    } else {
      return NextResponse.json({ error: 'Could not parse AI response' }, { status: 500 })
    }
  }

  return NextResponse.json({ result, question })
}
