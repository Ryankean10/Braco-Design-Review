import { NextRequest, NextResponse } from 'next/server'
import { requireRole, INTERNAL_ROLES } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import mammoth from 'mammoth'
import pdf from 'pdf-parse'

const anthropic = new Anthropic()

export async function POST(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  await params
  const auth = await requireRole(INTERNAL_ROLES)
  if ('error' in auth) return auth.error

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  let text = ''

  if (file.name.endsWith('.docx') || file.type.includes('wordprocessingml')) {
    const result = await mammoth.extractRawText({ buffer })
    text = result.value
  } else {
    const result = await pdf(buffer)
    text = result.text
  }

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4000,
    thinking: { type: 'adaptive' },
    messages: [{
      role: 'user',
      content: `Extract the following fields from this RFI/TQ document and return JSON only (no markdown). If a field is not present return null.\n\nFields to extract:\n- number (RFI/TQ number e.g. TQ-005)\n- type (\"RFI\" or \"TQ\")\n- title (subject/title)\n- date_received (ISO date string or null)\n- date_sent (ISO date string or null)\n- to_contact (person/company it was sent to)\n- from_contact (person/company who sent it)\n- contractor_name\n- document_reference\n- document_title\n- description (Part 2: query/question text)\n- proposed_solution (contractor proposed solution)\n- possible_solutions\n- is_scope_change (boolean)\n- cost_impact\n- programme_impact\n- response_required_by (ISO date string or null)\n\nDocument text:\n${text.slice(0, 8000)}`,
    }],
  })

  const textBlock = message.content.find((b: any) => b.type === 'text')
  const raw = (textBlock as any)?.text ?? '{}'
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw)
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ error: 'Parse failed', raw }, { status: 422 })
  }
}
