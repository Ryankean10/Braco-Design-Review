import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { logApiUsage } from '@/lib/logApiUsage'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function parseDriverReply(opts: {
  replyText: string
  driverEmail: string
  sheetDate: string   // YYYY-MM-DD
  companyId: string
  emailThreadId?: string
}) {
  const { replyText, driverEmail, sheetDate, companyId, emailThreadId } = opts
  const admin = adminClient()

  // Find driver
  const { data: driver } = await admin.from('people').select('id, name').eq('email', driverEmail).eq('company_id', companyId).maybeSingle()
  if (!driver) return { error: `No driver found with email ${driverEmail}` }

  // Get tasks planned for this driver on this date
  const { data: tasks } = await admin
    .from('haulage_tasks')
    .select('id, title, description, location, est_start, est_end, project_id, projects(name)')
    .eq('driver_id', driver.id)
    .eq('task_date', sheetDate)
    .order('sort_order')

  // Get all projects for matching
  const { data: projects } = await admin.from('projects').select('id, name').eq('company_id', companyId)

  const taskContext = (tasks ?? []).map((t, i) =>
    `Task ${i + 1} (id: ${t.id}): ${t.title}${t.location ? ` @ ${t.location}` : ''}${(t.projects as any)?.name ? ` [project: ${(t.projects as any).name}, id: ${t.project_id}]` : ''}`
  ).join('\n')

  const projectContext = (projects ?? []).map(p => `"${p.name}" (id: ${p.id})`).join(', ')

  const prompt = `You are parsing a haulage driver's end-of-day email reply to extract time records.

DATE: ${sheetDate}
DRIVER: ${driver.name}

PLANNED TASKS FOR TODAY:
${taskContext || 'None planned'}

ALL PROJECTS IN THE SYSTEM:
${projectContext || 'None'}

DRIVER'S REPLY:
"""
${replyText}
"""

Extract every time entry from the reply. For each entry return:
- description: what the driver did
- task_id: matching planned task id — match by DESCRIPTION SIMILARITY, not by "Task 1/2/3" position number. Only match if the work described clearly corresponds to the planned task (same location, same type of work). If the driver says "Task 2" but the description doesn't match planned task 2, do not force-match it.
- project_id: matching project id (or null if unidentifiable — flag it)
- start_time: HH:MM (24hr) or null
- end_time: HH:MM (24hr) or null
- hours: calculated decimal hours (or null)
- is_adhoc: true if not on the planned task list
- is_flagged: true if project cannot be identified from the reply or system
- flag_reason: brief explanation if flagged (e.g. "Mentioned 'Inverness job' but no matching project found")

CRITICAL — check every planned task against the reply. A planned task is only covered if the driver's description matches the SPECIFIC work, location, and material in the task. Examples of non-matches:
- Planned: "take spoil from Roth to waste disposal" vs Reply: "waste wood back to yard" — DIFFERENT (different material, different route, different destination)
- Planned: "delivery to Dyce site" vs Reply: "dropped off materials somewhere" — DIFFERENT (location not confirmed)
If in doubt, mark as missing. Do not match tasks just because the driver numbered them "Task 1", "Task 2" etc — numbers are unreliable. Add every unmatched planned task to "missing_tasks".

Return ONLY valid JSON, no markdown:
{
  "lines": [...],
  "missing_tasks": [{ "task_id": "...", "title": "..." }],
  "total_hours": number,
  "notes": "any general observations or issues"
}`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })
  logApiUsage({ companyId, endpoint: 'haulage-parser', model: message.model, inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens }).catch(() => {})

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  let parsed: any
  try {
    const start = raw.indexOf('{'); const end = raw.lastIndexOf('}')
    parsed = JSON.parse(raw.slice(start, end + 1))
  } catch {
    return { error: 'AI could not parse the reply — check raw reply manually' }
  }

  const lines: any[] = parsed.lines ?? []
  const missingTasks: any[] = parsed.missing_tasks ?? []
  const hasFlagged = lines.some((l: any) => l.is_flagged) || missingTasks.length > 0

  // Upsert daily sheet
  const { data: sheet, error: sheetErr } = await admin
    .from('haulage_daily_sheets')
    .upsert({
      company_id: companyId,
      driver_id: driver.id,
      sheet_date: sheetDate,
      status: hasFlagged ? 'flagged' : 'received',
      reply_received_at: new Date().toISOString(),
      raw_reply: replyText,
      email_thread_id: emailThreadId ?? null,
      total_hours: parsed.total_hours ?? null,
      notes: parsed.notes ?? null,
      missing_tasks: missingTasks.length > 0 ? missingTasks : null,
    }, { onConflict: 'driver_id,sheet_date' })
    .select()
    .single()

  if (sheetErr || !sheet) return { error: `Failed to save sheet: ${sheetErr?.message}` }

  // Delete existing lines and reinsert (idempotent re-parse)
  await admin.from('haulage_sheet_lines').delete().eq('sheet_id', sheet.id)

  if (lines.length > 0) {
    await admin.from('haulage_sheet_lines').insert(
      lines.map((l: any, i: number) => ({
        sheet_id: sheet.id,
        task_id: l.task_id ?? null,
        project_id: l.project_id ?? null,
        description: l.description,
        start_time: l.start_time ?? null,
        end_time: l.end_time ?? null,
        hours: l.hours ?? null,
        is_flagged: l.is_flagged ?? false,
        flag_reason: l.flag_reason ?? null,
        is_adhoc: l.is_adhoc ?? false,
        sort_order: i,
      }))
    )
  }

  return { ok: true, sheetId: sheet.id, hasFlagged, lineCount: lines.length, missingTaskCount: missingTasks.length }
}
