import { NextRequest, NextResponse } from 'next/server'
export const maxDuration = 120

import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { extractAndParse } from '@/lib/repairJson'
import { requireRole, INTERNAL_ROLES } from '@/lib/auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const auth = await requireRole(INTERNAL_ROLES)
  if ('error' in auth) return auth.error
  const supabase = await createClient()

  const { data: project } = await supabase.from('projects').select('*, companies(name, industry)').eq('id', projectId).single()
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

  const companyName = (project as any).companies?.name ?? 'the contractor'
  const ragSummary = project.er_rag_summary ? JSON.stringify(project.er_rag_summary) : 'No prior RAG assessment'

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `You are a senior UK contracts manager and commercial director. You have already produced a quick RAG contractual risk assessment for this contract on behalf of ${companyName}. Now produce a full contractual analysis digging into the specific clauses, financial exposure, and negotiation points.

Prior RAG summary: ${ragSummary}

Focus on CONTRACTUAL issues — payment, liability, risk allocation, programme obligations, termination rights, scope gaps. Do not summarise the physical scope of works.

For each Red or Amber risk area from the RAG:
- Quote or reference the specific clause(s) that create the risk
- Explain the financial or legal exposure in plain English
- Suggest specific wording changes, qualifications, or commercial mitigations

Also produce a contractual risk register suitable for presenting to the board or client.

Return ONLY valid JSON, no other text:
{
  "overview": "2-3 paragraph executive summary of the contractual position and overall risk level for ${companyName}",
  "risks": [
    {
      "area": "Risk area name (match the RAG area)",
      "rating": "red"|"amber",
      "detail": "Detailed analysis: which clause, what it means, what the exposure is, and why it matters (2-3 paragraphs)",
      "clauses": ["Clause X.X — quoted or paraphrased text"],
      "mitigations": ["Specific mitigation or negotiation point 1", "Point 2", "Point 3"]
    }
  ],
  "register": [
    {
      "risk": "Concise risk description",
      "likelihood": "High"|"Medium"|"Low",
      "impact": "High"|"Medium"|"Low",
      "mitigation": "Specific action to reduce the risk",
      "owner": "Contracts Manager"|"Commercial Manager"|"Director"|"Legal"
    }
  ]
}

CONTRACT / ER DOCUMENT:
${erTextTruncated}`
    }]
  })

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
  let result: { overview: string; risks: any[]; register: any[] }
  try {
    result = extractAndParse(responseText)
    if (!result.overview) result.overview = ''
    if (!Array.isArray(result.risks)) result.risks = []
    if (!Array.isArray(result.register)) result.register = []
  } catch (e: any) {
    return NextResponse.json({ error: `Failed to parse response: ${e.message}` }, { status: 500 })
  }

  await supabase.from('projects').update({
    er_deep_analysis: result,
    er_deep_analysed_at: new Date().toISOString(),
  }).eq('id', projectId)

  return NextResponse.json(result)
}
