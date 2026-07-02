import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  // Dynamic import to avoid edge runtime issues
  const pdfParse = (await import('pdf-parse')).default
  try {
    const result = await pdfParse(pdfBuffer)
    return result.text?.trim() ?? ''
  } catch {
    return ''
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string; progId: string }> }
) {
  const { siteId, progId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch this programme and the previous one for comparison
  const { data: allProgs } = await admin
    .from('construction_programmes')
    .select('id, revision, programme_date, file_path, file_name, analysis')
    .eq('site_id', siteId)
    .order('uploaded_at', { ascending: false })

  if (!allProgs || allProgs.length === 0) {
    return NextResponse.json({ error: 'No programmes found' }, { status: 404 })
  }

  const current = allProgs.find(p => p.id === progId)
  if (!current) return NextResponse.json({ error: 'Programme not found' }, { status: 404 })

  const previous = allProgs.find(p => p.id !== progId)

  // Download and extract text from current PDF
  const { data: currentFile } = await admin.storage
    .from('construction-programmes')
    .download(current.file_path)

  if (!currentFile) return NextResponse.json({ error: 'Could not download programme file' }, { status: 500 })

  const currentBuffer = Buffer.from(await currentFile.arrayBuffer())
  const currentText = await extractPdfText(currentBuffer)

  // Download and extract text from previous PDF if it exists
  let previousText = ''
  let previousRevision = ''
  if (previous) {
    const { data: prevFile } = await admin.storage
      .from('construction-programmes')
      .download(previous.file_path)
    if (prevFile) {
      const prevBuffer = Buffer.from(await prevFile.arrayBuffer())
      previousText = await extractPdfText(prevBuffer)
      previousRevision = previous.revision
    }
  }

  const hasPrevious = !!previous && previousText.length > 50
  const currentDate = new Date(current.programme_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const prompt = hasPrevious
    ? `You are a BESS construction planner analysing two revisions of a Primavera P6 construction programme for a UK battery energy storage project.

CURRENT PROGRAMME — ${current.revision} (${currentDate}):
${currentText.substring(0, 8000)}

PREVIOUS PROGRAMME — ${previousRevision} (${new Date(previous!.programme_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}):
${previousText.substring(0, 8000)}

Produce a structured Planned vs Actual / revision comparison analysis. Return JSON only:
{
  "summary": "2-3 sentence executive summary of the revision changes and programme health",
  "overall_status": "On Programme" | "Slipping" | "Critical" | "Ahead",
  "completion_date_current": "date string or null",
  "completion_date_previous": "date string or null",
  "slippage_days": number (positive = slipping, negative = ahead),
  "key_changes": [
    { "activity": "activity name", "change": "description", "impact": "Critical" | "Major" | "Minor" }
  ],
  "critical_path_changes": ["change 1", "change 2"],
  "float_erosion": ["area 1", "area 2"],
  "risks": ["risk 1", "risk 2"],
  "recommendations": ["action 1", "action 2"],
  "analysed_at": "${new Date().toISOString()}"
}`
    : `You are a BESS construction planner reviewing a Primavera P6 construction programme for a UK battery energy storage project.

PROGRAMME — ${current.revision} (${currentDate}):
${currentText.substring(0, 10000)}

This is the first revision uploaded. Produce a baseline programme analysis. Return JSON only:
{
  "summary": "2-3 sentence summary of the programme scope and key milestones",
  "overall_status": "On Programme" | "Slipping" | "Critical" | "Ahead",
  "completion_date_current": "date string or null",
  "completion_date_previous": null,
  "slippage_days": 0,
  "key_changes": [],
  "critical_path_changes": ["Identify the critical path activities from the programme"],
  "float_erosion": [],
  "risks": ["Identify any schedule risks visible in this baseline"],
  "recommendations": ["Identify any programme recommendations"],
  "analysed_at": "${new Date().toISOString()}"
}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }]
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return NextResponse.json({ error: 'Failed to parse AI analysis' }, { status: 500 })

  const analysis = JSON.parse(jsonMatch[0])

  // Store analysis back on the programme record
  await admin
    .from('construction_programmes')
    .update({ analysis })
    .eq('id', progId)

  return NextResponse.json(analysis)
}
