import { createClient as createServiceClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default
  try {
    const result = await pdfParse(pdfBuffer)
    return result.text?.trim() ?? ''
  } catch {
    return ''
  }
}

export async function analyseProgramme(siteId: string, progId: string) {
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: allProgs } = await admin
    .from('construction_programmes')
    .select('id, revision, programme_date, file_path, file_name, analysis')
    .eq('site_id', siteId)
    .order('uploaded_at', { ascending: false })

  if (!allProgs?.length) throw new Error('No programmes found')

  const current = allProgs.find((p: any) => p.id === progId)
  if (!current) throw new Error('Programme not found')

  const previous = allProgs.find((p: any) => p.id !== progId)

  const { data: currentFile } = await admin.storage
    .from('construction-programmes')
    .download(current.file_path)
  if (!currentFile) throw new Error('Could not download programme file')

  const currentText = await extractPdfText(Buffer.from(await currentFile.arrayBuffer()))

  let previousText = ''
  let previousRevision = ''
  if (previous) {
    const { data: prevFile } = await admin.storage
      .from('construction-programmes')
      .download(previous.file_path)
    if (prevFile) {
      previousText = await extractPdfText(Buffer.from(await prevFile.arrayBuffer()))
      previousRevision = previous.revision
    }
  }

  const hasPrevious = !!previous && previousText.length > 50
  const today = new Date()
  const todayStr = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const currentDate = new Date(current.programme_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const sharedContext = `TODAY'S DATE: ${todayStr}
Use today's date to determine what has already passed, what is currently due, and what is upcoming in the next 4 weeks.`

  const jsonSchema = `{
  "summary": "2-3 sentence executive summary of overall programme health relative to today",
  "overall_status": "On Programme" | "Slipping" | "Critical" | "Ahead",
  "completion_date_current": "planned completion date string or null",
  "completion_date_previous": "previous revision completion date or null",
  "slippage_days": number,
  "status_today": [
    "Bullet: where the project stands right now against the programme — specific phase/activity as of today",
    "Bullet: reference actual activity names and planned dates from the programme",
    "Bullet: anything that should be complete by today but may not be"
  ],
  "critical_path": [
    "Activity on critical path — include planned start/finish dates where visible"
  ],
  "upcoming_activities": [
    {
      "activity": "Activity name from programme",
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

Produce a detailed analysis focusing on: (1) where the project stands TODAY, (2) critical path activities with dates, (3) upcoming activities in the next 4 weeks. Return JSON only, no markdown fences:
${jsonSchema}`
    : `You are a BESS construction planner reviewing a Primavera P6 construction programme for a UK battery energy storage project.
${sharedContext}

PROGRAMME — ${current.revision} (issued ${currentDate}):
${currentText.substring(0, 10000)}

Produce a baseline analysis focusing on: (1) where the project should be TODAY against this programme, (2) critical path activities with dates, (3) activities due in the next 4 weeks. Return JSON only, no markdown fences:
${jsonSchema}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 5000,
    messages: [{ role: 'user', content: prompt }]
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object in response')

  let jsonStr = stripped.slice(start, end + 1)

  function repairJson(s: string): string {
    let repaired = s.replace(/,\s*$/, '').replace(/,\s*\{[^}]*$/, '')
    const stack: string[] = []
    let inStr = false, esc = false
    for (const ch of repaired) {
      if (esc) { esc = false; continue }
      if (ch === '\\') { esc = true; continue }
      if (ch === '"') { inStr = !inStr; continue }
      if (!inStr) {
        if (ch === '{' || ch === '[') stack.push(ch === '{' ? '}' : ']')
        if (ch === '}' || ch === ']') stack.pop()
      }
    }
    return repaired + stack.reverse().join('')
  }

  let analysis: any
  try {
    analysis = JSON.parse(jsonStr)
  } catch {
    try {
      analysis = JSON.parse(repairJson(jsonStr))
    } catch (e2: any) {
      throw new Error('Failed to parse AI analysis: ' + e2.message)
    }
  }

  await admin
    .from('construction_programmes')
    .update({ analysis })
    .eq('id', progId)

  return analysis
}
