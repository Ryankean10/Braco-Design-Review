import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, INTERNAL_ROLES } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export async function POST(_req: NextRequest, { params }: { params: Promise<{ siteId: string; rfiId: string }> }) {
  const { siteId, rfiId } = await params
  const auth = await requireRole(INTERNAL_ROLES)
  if ('error' in auth) return auth.error

  const supabase = await createClient()

  const { data: rfi } = await supabase
    .from('rfis_tqs')
    .select('*')
    .eq('id', rfiId)
    .eq('site_id', siteId)
    .single()
  if (!rfi) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Get site → project_id
  const { data: site } = await supabase
    .from('construction_sites')
    .select('project_id')
    .eq('id', siteId)
    .single()

  const projectId = site?.project_id

  // Gather RFI-specific attachments
  const { data: attachments } = await supabase
    .from('rfi_tq_attachments')
    .select('file_name, storage_path, mime_type')
    .eq('rfi_tq_id', rfiId)

  const attachmentTexts: string[] = []
  for (const att of attachments ?? []) {
    if (!att.mime_type?.includes('pdf') && !att.file_name?.endsWith('.docx')) continue
    const { data: fileData } = await supabase.storage.from('documents').download(att.storage_path)
    if (!fileData) continue
    try {
      const buf = Buffer.from(await fileData.arrayBuffer())
      if (att.file_name?.endsWith('.docx')) {
        const mammoth = await import('mammoth')
        const r = await mammoth.default.extractRawText({ buffer: buf })
        attachmentTexts.push(`[Attachment: ${att.file_name}]\n${r.value.slice(0, 3000)}`)
      } else {
        const pdf = await import('pdf-parse')
        const r = await pdf.default(buf)
        attachmentTexts.push(`[Attachment: ${att.file_name}]\n${r.text.slice(0, 3000)}`)
      }
    } catch { /* skip unreadable */ }
  }

  // Gather project docs if we have a projectId
  const projectDocTexts: string[] = []
  if (projectId) {
    const { data: docs } = await supabase
      .from('documents')
      .select('file_name, storage_path, document_type')
      .eq('project_id', projectId)
      .limit(5)

    for (const doc of docs ?? []) {
      const { data: fileData } = await supabase.storage.from('documents').download(doc.storage_path)
      if (!fileData) continue
      try {
        const buf = Buffer.from(await fileData.arrayBuffer())
        const pdf = await import('pdf-parse')
        const r = await pdf.default(buf)
        projectDocTexts.push(`[${doc.document_type ?? 'Document'}: ${doc.file_name}]\n${r.text.slice(0, 2000)}`)
      } catch { /* skip */ }
    }
  }

  const contextSections = [
    attachmentTexts.length ? `## RFI/TQ Attachments\n${attachmentTexts.join('\n\n')}` : '',
    projectDocTexts.length ? `## Project Documents\n${projectDocTexts.join('\n\n')}` : '',
  ].filter(Boolean).join('\n\n')

  const rfiText = `Type: ${rfi.type ?? 'TQ'}\nNumber: ${rfi.number ?? ''}\nTitle: ${rfi.title}\nDescription: ${rfi.description ?? ''}\nProposed Solution: ${rfi.proposed_solution ?? ''}`

  const prompt = contextSections
    ? `You are reviewing a Technical Query / RFI for a BESS (Battery Energy Storage System) construction project. Using the project documents and attachments provided, find whether there is a documented answer to this RFI/TQ.\n\n## RFI/TQ\n${rfiText}\n\n${contextSections}\n\nRespond in JSON only (no markdown fences) with:\n{\n  "found_in_documents": true/false,\n  "confidence": "high"|"medium"|"low",\n  "sources": [{"document": "...", "clause": "...", "quote": "verbatim excerpt max 200 chars"}],\n  "technical_analysis": "concise technical analysis",\n  "suggested_response": "suggested response text"\n}`
    : `You are a BESS (Battery Energy Storage System) construction expert. No project documents are available. Provide a technical analysis and suggested response for this RFI/TQ based on your engineering knowledge.\n\n## RFI/TQ\n${rfiText}\n\nRespond in JSON only with:\n{\n  "found_in_documents": false,\n  "confidence": "low",\n  "sources": [],\n  "technical_analysis": "...",\n  "suggested_response": "..."\n}`

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4000,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: prompt }],
  })

  const textBlock = message.content.find((b: any) => b.type === 'text')
  const raw = (textBlock as any)?.text ?? '{}'
  let result: Record<string, unknown>
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    result = JSON.parse(jsonMatch ? jsonMatch[0] : raw)
  } catch {
    return NextResponse.json({ error: 'Parse failed', raw }, { status: 422 })
  }

  await supabase.from('rfis_tqs').update({
    ai_analysis: result,
    ai_analysed_at: new Date().toISOString(),
  }).eq('id', rfiId)

  return NextResponse.json(result)
}
