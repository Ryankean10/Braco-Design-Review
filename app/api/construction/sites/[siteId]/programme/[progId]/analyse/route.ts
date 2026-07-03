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
  const today = new Date()
  const todayStr = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const currentDate = new Date(current.programme_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const sharedContext = `
TODAY'S DATE: ${todayStr}
Use today's date to determine what has already passed, what is currently due, and what is upcoming in the next 4 weeks.
`

  const jsonSchema = `{
  "summary": "2-3 sentence executive summary of overall programme health relative to today",
  "overall_status": "On Programme" | "Slipping" | "Critical" | "Ahead",
  "completion_date_current": "planned completion date string or null",
  "completion_date_previous": "previous revision completion date or null",
  "slippage_days": number,
  "status_today": [
    "Bullet point of where the project stands right now against the programme — be specific about what phase/activity is current as of today",
    "Another bullet — reference actual activity names and planned dates from the programme",
    "Another bullet — call out anything that should be complete by today but may not be"
  ],
  "critical_path": [
    "Activity on the critical path — include planned start/finish dates where visible",
    "Next critical path activity"
  ],
  "upcoming_activities": [
    {
      "activity": "Activity name",
      "due": "planned date string",
      "days_away": number,
      "impact": "Critical" | "Major" | "Minor",
      "note": "Why this matters to overall completion"
    }
  ],
  "key_changes": [
    { "activity": "activity name", "change": "what changed vs previous rev", "impact": "Critical" | "Major" | "Minor" }
  ],
  "risks": ["Schedule risk 1", "Schedule risk 2"],
  "recommendations": ["Specific action 1", "Specific action 2"],
  "analysed_at": "${new Date().toISOString()}"
}`

  const prompt = hasPrevious
    ? `You are a BESS construction planner analysing two revisions of a Primavera P6 construction programme for a UK battery energy storage project.
${sharedContext}
CURRENT PROGRAMME — ${current.revision} (issued ${currentDate}):
${currentText.substring(0, 7000)}

PREVIOUS PROGRAMME — ${previousRevision} (issued ${new Date(previous!.programme_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}):
${previousText.substring(0, 5000)}

Produce a detailed analysis. Focus especially on:
1. Where the project stands TODAY against the programme (status_today bullets)
2. The critical path activities and their dates
3. Upcoming activities in the next 4 weeks that could affect completion if they slip

Return JSON only, no markdown:
${jsonSchema}`
    : `You are a BESS construction planner reviewing a Primavera P6 construction programme for a UK battery energy storage project.
${sharedContext}
PROGRAMME — ${current.revision} (issued ${currentDate}):
${currentText.substring(0, 10000)}

Produce a detailed baseline analysis. Focus especially on:
1. Where the project should be TODAY against this programme (status_today bullets)
2. The critical path activities and their dates
3. Activities due in the next 4 weeks that are critical to overall completion

Return JSON only, no markdown:
${jsonSchema}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
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
