import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as serviceClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 120

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

function service() {
  return serviceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function extractPdfText(fileData: Blob): Promise<string> {
  const buf = Buffer.from(await fileData.arrayBuffer())
  const { createRequire } = await import('module')
  const require = createRequire(import.meta.url)
  const pdfParse = require('pdf-parse/lib/pdf-parse.js')
  const parsed = await pdfParse(buf)
  return (parsed.text as string) ?? ''
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ standardId: string }> }
) {
  const { standardId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'engineer'].includes(profile?.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = service()

  const { data: standard } = await admin
    .from('standards')
    .select('ref, title, category, summary, doc_storage_path, doc_file_name')
    .eq('id', standardId)
    .single()

  if (!standard) return NextResponse.json({ error: 'Standard not found' }, { status: 404 })
  if (!standard.doc_storage_path) return NextResponse.json({ error: 'No document uploaded for this standard' }, { status: 400 })

  // Download and extract PDF text
  const { data: fileData, error: dlErr } = await admin.storage
    .from('documents')
    .download(standard.doc_storage_path)

  if (dlErr || !fileData) return NextResponse.json({ error: 'Could not download document' }, { status: 500 })

  let docText: string
  try {
    docText = await extractPdfText(fileData)
    if (docText.trim().length < 100) {
      return NextResponse.json({ error: 'Could not extract readable text — document may be a scanned image PDF' }, { status: 400 })
    }
  } catch (e: unknown) {
    return NextResponse.json({ error: `PDF extraction failed: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }

  // Run Claude analysis
  const prompt = `You are a UK BESS engineering standards expert. Analyse the following standard document and return ONLY a JSON object.

Standard: ${standard.ref} — ${standard.title}
Category: ${standard.category}

Return this exact JSON structure:
{
  "summary": "2-3 sentence plain-English summary of what this standard covers and its purpose",
  "ai_key_points": [
    "key clause or requirement string (be specific, quote clause numbers where possible)",
    ...up to 15 key points
  ],
  "ai_bess_applicability": "2-3 sentences specifically on how this standard applies to BESS (battery energy storage) projects — what it mandates, what engineers must watch for, any BESS-specific requirements or exemptions"
}

DOCUMENT TEXT (first 40,000 characters):
${docText.slice(0, 40000)}`

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) return NextResponse.json({ error: 'AI response did not contain valid JSON' }, { status: 500 })

  let result: { summary: string; ai_key_points: string[]; ai_bess_applicability: string }
  try {
    result = JSON.parse(m[0])
  } catch {
    return NextResponse.json({ error: 'Could not parse AI response' }, { status: 500 })
  }

  // Save to DB
  const { error: saveErr } = await admin
    .from('standards')
    .update({
      ai_summary: result.summary,
      ai_key_points: result.ai_key_points,
      ai_bess_applicability: result.ai_bess_applicability,
      ai_analysed_at: new Date().toISOString(),
    })
    .eq('id', standardId)

  if (saveErr) return NextResponse.json({ error: saveErr.message }, { status: 500 })

  return NextResponse.json({ success: true, ...result })
}
