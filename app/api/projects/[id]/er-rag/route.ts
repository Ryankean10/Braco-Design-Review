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

  const erTextTruncated = erText.length > 40000
    ? erText.slice(0, 40000) + '\n\n[... document truncated ...]'
    : erText

  const companyName = (project as any).companies?.name ?? 'the contractor'
  const industry = (project as any).companies?.industry ?? 'civils'

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `You are a senior UK contracts manager and commercial director reviewing a contract/ER document on behalf of ${companyName}, a ${industry} contractor. Your job is to give a quick Red/Amber/Green rating across key CONTRACTUAL risk areas — not construction activities.

Focus on the contractual and commercial terms: what does the contract say about money, time, liability, risk allocation, and dispute? Flag anything that exposes ${companyName} to financial or legal risk.

Rate each area as "red" (significant contractual exposure, needs urgent attention), "amber" (moderate risk or ambiguous wording), or "green" (acceptable terms or not applicable). Give a single brief reason (max 15 words) — no details yet.

Return ONLY valid JSON, no other text:
{
  "items": [
    { "area": "Payment Terms & Retention", "rating": "red"|"amber"|"green", "brief": "brief reason max 15 words" },
    { "area": "Variations & Dayworks", "rating": "...", "brief": "..." },
    { "area": "Liquidated Damages / Delay Penalties", "rating": "...", "brief": "..." },
    { "area": "Design Responsibility & PI", "rating": "...", "brief": "..." },
    { "area": "Ground Conditions & Unforeseen Risk", "rating": "...", "brief": "..." },
    { "area": "Insurance & Performance Bond", "rating": "...", "brief": "..." },
    { "area": "Programme & Time at Large", "rating": "...", "brief": "..." },
    { "area": "Scope Definition & Ambiguity", "rating": "...", "brief": "..." },
    { "area": "Termination & Suspension Rights", "rating": "...", "brief": "..." },
    { "area": "Dispute Resolution & Adjudication", "rating": "...", "brief": "..." }
  ]
}

CONTRACT / ER DOCUMENT:
${erTextTruncated}`
    }]
  })

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
  let result: { items: any[] }
  try {
    result = extractAndParse(responseText)
    if (!Array.isArray(result.items)) result.items = []
  } catch (e: any) {
    return NextResponse.json({ error: `Failed to parse response: ${e.message}` }, { status: 500 })
  }

  await supabase.from('projects').update({
    er_rag_summary: result.items,
    er_rag_analysed_at: new Date().toISOString(),
  }).eq('id', projectId)

  return NextResponse.json({ items: result.items })
}
