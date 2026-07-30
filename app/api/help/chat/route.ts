import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { logApiUsage } from '@/lib/logApiUsage'
import { getResendClient } from '@/lib/resend'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'list_sites',
    description: 'List all construction sites with their status, location, and basic info.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_site_personnel',
    description: 'Get the list of people appointed to a site on a given date, minus anyone on approved holiday. Returns who is expected on site.',
    input_schema: {
      type: 'object' as const,
      properties: {
        site_name: { type: 'string', description: 'Site name or partial name (e.g. "Dyce")' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format. Defaults to today.' },
      },
      required: ['site_name'],
    },
  },
  {
    name: 'get_daily_log',
    description: 'Get the daily site diary/log for a site on a given date — weather, crew, issues, summary.',
    input_schema: {
      type: 'object' as const,
      properties: {
        site_name: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD. Defaults to today.' },
      },
      required: ['site_name'],
    },
  },
  {
    name: 'get_daily_brief',
    description: 'Get the AI-generated daily site brief for a site — personnel, planned works, weather, H&S fact, issues carried over.',
    input_schema: {
      type: 'object' as const,
      properties: {
        site_name: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD. Defaults to today.' },
      },
      required: ['site_name'],
    },
  },
  {
    name: 'get_recent_logs',
    description: 'Get the last N daily logs for a site — useful for spotting trends, recurring issues, or recent activity.',
    input_schema: {
      type: 'object' as const,
      properties: {
        site_name: { type: 'string' },
        days: { type: 'number', description: 'Number of recent days to fetch (default 7, max 30)' },
      },
      required: ['site_name'],
    },
  },
  {
    name: 'get_people',
    description: 'Get the team directory — people, their roles, disciplines, and companies.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name_filter: { type: 'string', description: 'Optional: filter by name' },
      },
      required: [],
    },
  },
  {
    name: 'get_timesheets',
    description: 'Get timesheet submissions — filter by person name or week.',
    input_schema: {
      type: 'object' as const,
      properties: {
        person_name: { type: 'string', description: 'Optional person name filter' },
        week_starting: { type: 'string', description: 'Optional YYYY-MM-DD Monday date' },
        status: { type: 'string', description: 'Optional: Draft, Submitted, Approved, Rejected' },
      },
      required: [],
    },
  },
  {
    name: 'get_holidays',
    description: 'Get holiday bookings — filter by person name or status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        person_name: { type: 'string' },
        status: { type: 'string', description: 'Pending, Approved, Rejected' },
      },
      required: [],
    },
  },
  {
    name: 'get_rfi_tqs',
    description: 'Get the RFI/TQ register for a site.',
    input_schema: {
      type: 'object' as const,
      properties: {
        site_name: { type: 'string' },
        status: { type: 'string', description: 'Optional status filter: open, submitted_to_client, response_received, closed' },
      },
      required: ['site_name'],
    },
  },
  {
    name: 'read_programme',
    description: 'Read and extract the text content from the latest uploaded programme PDF for a site. Use this to understand schedule, planned activities, dates, milestones, disciplines, and resource allocations. Essential for programme-related questions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        site_name: { type: 'string', description: 'Site name or partial name (e.g. "Dyce", "Kilwinning", "Braco")' },
      },
      required: ['site_name'],
    },
  },
]

// ── Tool execution ────────────────────────────────────────────────────────────

async function findSite(name: string) {
  const { data } = await admin
    .from('construction_sites')
    .select('id, name, location, status, capacity_mw, start_date, end_date')
    .ilike('name', `%${name}%`)
    .limit(1)
  return data?.[0] ?? null
}

async function executeTool(name: string, input: any, companyId: string | null): Promise<string> {
  const today = new Date().toISOString().slice(0, 10)

  if (name === 'list_sites') {
    const { data } = await admin.from('construction_sites').select('name, location, status, capacity_mw, start_date, end_date')
    return JSON.stringify(data ?? [])
  }

  if (name === 'get_site_personnel') {
    const site = await findSite(input.site_name)
    if (!site) return `No site found matching "${input.site_name}"`
    const date = input.date ?? today

    const { data: appointments } = await admin
      .from('job_appointments')
      .select('role_on_job, is_manager, people(id, name, role, discipline, company)')
      .eq('site_id', site.id)
      .or(`start_date.is.null,start_date.lte.${date}`)
      .or(`end_date.is.null,end_date.gte.${date}`)

    const personIds = (appointments ?? []).map((a: any) => (a.people as any)?.id).filter(Boolean)
    const { data: holidays } = personIds.length > 0
      ? await admin.from('holiday_bookings').select('person_id').in('person_id', personIds).eq('status', 'Approved').lte('start_date', date).gte('end_date', date)
      : { data: [] }

    const absentIds = new Set((holidays ?? []).map((h: any) => h.person_id))
    const on: any[] = [], off: any[] = []
    for (const a of appointments ?? []) {
      const p = a.people as any
      if (!p) continue
      if (absentIds.has(p.id)) off.push(p.name)
      else on.push({ name: p.name, role: a.role_on_job || p.role, company: p.company, is_manager: a.is_manager })
    }
    return JSON.stringify({ site: site.name, date, on_site: on, absent_holiday: off })
  }

  if (name === 'get_daily_log') {
    const site = await findSite(input.site_name)
    if (!site) return `No site found matching "${input.site_name}"`
    const date = input.date ?? today
    const { data } = await admin.from('site_daily_logs').select('*').eq('site_id', site.id).eq('log_date', date).maybeSingle()
    return data ? JSON.stringify(data) : `No daily log found for ${site.name} on ${date}`
  }

  if (name === 'get_daily_brief') {
    const site = await findSite(input.site_name)
    if (!site) return `No site found matching "${input.site_name}"`
    const date = input.date ?? today
    const { data } = await admin.from('site_daily_briefs').select('*').eq('site_id', site.id).eq('brief_date', date).maybeSingle()
    return data ? JSON.stringify(data) : `No daily brief generated for ${site.name} on ${date}`
  }

  if (name === 'get_recent_logs') {
    const site = await findSite(input.site_name)
    if (!site) return `No site found matching "${input.site_name}"`
    const days = Math.min(input.days ?? 7, 30)
    const from = new Date(); from.setDate(from.getDate() - days)
    const { data } = await admin.from('site_daily_logs').select('log_date, weather_description, temp_c, total_manhours, issues, summary').eq('site_id', site.id).gte('log_date', from.toISOString().slice(0, 10)).order('log_date', { ascending: false })
    return JSON.stringify(data ?? [])
  }

  if (name === 'get_people') {
    let q = admin.from('people').select('name, role, discipline, company, email').eq('is_active', true)
    if (companyId) q = q.eq('company_id', companyId)
    if (input.name_filter) q = q.ilike('name', `%${input.name_filter}%`)
    const { data } = await q.order('name').limit(50)
    return JSON.stringify(data ?? [])
  }

  if (name === 'get_timesheets') {
    let q = admin.from('weekly_timesheets').select('week_starting, status, total_hours, people(name)').order('week_starting', { ascending: false }).limit(50)
    if (companyId) q = q.eq('company_id', companyId)
    if (input.week_starting) q = q.eq('week_starting', input.week_starting)
    if (input.status) q = q.eq('status', input.status)
    const { data } = await q
    let rows = data ?? []
    if (input.person_name) rows = rows.filter((r: any) => r.people?.name?.toLowerCase().includes(input.person_name.toLowerCase()))
    return JSON.stringify(rows)
  }

  if (name === 'get_holidays') {
    let q = admin.from('holiday_bookings').select('start_date, end_date, days_taken, status, description, people(name)').order('start_date', { ascending: false }).limit(50)
    if (companyId) q = q.eq('company_id', companyId)
    if (input.status) q = q.eq('status', input.status)
    const { data } = await q
    let rows = data ?? []
    if (input.person_name) rows = rows.filter((r: any) => r.people?.name?.toLowerCase().includes(input.person_name.toLowerCase()))
    return JSON.stringify(rows)
  }

  if (name === 'read_programme') {
    const site = await findSite(input.site_name)
    if (!site) return `No site found matching "${input.site_name}"`

    const { data: progs } = await admin
      .from('construction_programmes')
      .select('id, revision, programme_date, file_path, file_name, notes')
      .eq('site_id', site.id)
      .order('uploaded_at', { ascending: false })
      .limit(1)

    if (!progs?.length) return `No programme uploaded for ${site.name}`
    const prog = progs[0]

    try {
      const { data: fileData, error } = await admin.storage
        .from('construction-programmes')
        .download(prog.file_path)
      if (error || !fileData) return `Programme file found (${prog.file_name}, ${prog.revision}) but could not be downloaded: ${error?.message}`

      const buffer = Buffer.from(await fileData.arrayBuffer())
      const pdfParse = (await import('pdf-parse')).default
      const parsed = await pdfParse(buffer)
      const text = parsed.text?.trim() ?? ''
      if (!text) return `Programme file ${prog.file_name} (${prog.revision}) was downloaded but contains no extractable text — it may be a scanned image or Gantt chart image.`

      return `PROGRAMME: ${site.name} — ${prog.file_name} (${prog.revision}, dated ${prog.programme_date})\n\n${text.slice(0, 8000)}`
    } catch (err: any) {
      return `Error reading programme for ${site.name}: ${err.message}`
    }
  }

  if (name === 'get_rfi_tqs') {
    const site = await findSite(input.site_name)
    if (!site) return `No site found matching "${input.site_name}"`
    let q = admin.from('rfi_tqs').select('rfi_number, title, status, discipline, originator, date_raised, date_required, response_summary').eq('site_id', site.id).order('date_raised', { ascending: false })
    if (input.status) q = q.eq('status', input.status)
    const { data } = await q
    return JSON.stringify(data ?? [])
  }

  return `Unknown tool: ${name}`
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(industry: string): string {
  const today = new Date().toISOString().slice(0, 10)
  return `You are MRRK Assistant — an intelligent site management assistant for a UK construction platform managing BESS (Battery Energy Storage System) projects.

Today's date: ${today}

You have access to live data via tools. When someone asks about personnel, timesheets, holidays, daily logs, briefs, RFIs, or any site data — use the appropriate tool to fetch real information before answering. Never guess or make up data.

Capabilities:
- Who is on site today / on a given date (checks appointments vs approved holidays)
- Daily site logs — weather, crew, issues, summary
- AI daily briefs — planned works, carried-over issues, H&S facts
- Team directory and roles
- Timesheet submissions and status
- Holiday bookings
- RFI/TQ registers

Programme information: the programme is currently stored as PDF uploads only — no parsed schedule data is available yet. Tell the user this if they ask programme-specific questions.

Tone: professional, concise, direct. You are talking to site managers and engineers.

If the user describes a bug or something broken: set isBugReport: true in the JSON.
If it's a suggestion: set isSuggestion: true.

At the END of every response, output a raw JSON object on its own line (no markdown, no code fences):
{"isBugReport": false, "isSuggestion": false, "bugSummary": "n/a", "suggestedActions": []}`
}

// ── Bug logging ───────────────────────────────────────────────────────────────

const BUG_EMAIL = process.env.ALERT_EMAIL ?? 'rkean1995@gmail.com'

async function sendBugEmail(summary: string, userMessage: string, userName: string, userEmail: string, suggestedActions: string[], reportType: 'bug' | 'suggestion' = 'bug') {
  const { resend, fromEmail } = getResendClient(null)
  const isSuggestion = reportType === 'suggestion'
  await resend.emails.send({
    from: fromEmail,
    to: BUG_EMAIL,
    subject: isSuggestion ? `💡 MRRK Suggestion — ${new Date().toLocaleDateString('en-GB')}` : `🐛 MRRK Bug Report — ${new Date().toLocaleDateString('en-GB')}`,
    html: `<p><strong>${isSuggestion ? 'Suggestion' : 'Bug'}</strong> from ${userName} (${userEmail})</p><p>${summary}</p><p>Message: ${userMessage}</p>`,
  })
}

async function logBugToDb(summary: string, userMessage: string, userName: string, userEmail: string, userId: string, suggestedActions: string[], reportType: 'bug' | 'suggestion', companyId?: string | null) {
  await admin.from('bug_reports').insert({
    reporter_id: userId, reporter_name: userName, reporter_email: userEmail,
    user_message: userMessage, summary, suggested_actions: suggestedActions,
    status: 'open', report_type: reportType,
    priority: reportType === 'suggestion' ? 'low' : 'medium',
    ...(companyId ? { company_id: companyId } : {}),
  })
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages } = await req.json()
  if (!messages?.length) return NextResponse.json({ error: 'No messages' }, { status: 400 })

  const { data: profile } = await admin.from('profiles').select('full_name, company_id').eq('id', user.id).maybeSingle()
  const userName = (profile as any)?.full_name ?? user.email ?? 'Unknown'
  const companyId: string | null = (profile as any)?.company_id ?? null

  const { data: company } = companyId
    ? await admin.from('companies').select('industry, slug').eq('id', companyId).single()
    : await admin.from('companies').select('industry, slug').eq('slug', req.headers.get('x-company-slug') ?? 'braco').single()
  const industry = (company as any)?.industry ?? 'bess'

  // Agentic tool-use loop
  let apiMessages: Anthropic.MessageParam[] = messages
  let totalInput = 0, totalOutput = 0
  let finalText = ''

  for (let i = 0; i < 8; i++) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: buildSystemPrompt(industry),
      tools: TOOLS,
      messages: apiMessages,
    })
    totalInput += response.usage.input_tokens
    totalOutput += response.usage.output_tokens

    if (response.stop_reason === 'end_turn') {
      finalText = (response.content.find(b => b.type === 'text') as any)?.text ?? ''
      break
    }

    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use')
      apiMessages = [...apiMessages, { role: 'assistant', content: response.content }]

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block: any) => ({
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content: await executeTool(block.name, block.input, companyId),
        }))
      )
      apiMessages = [...apiMessages, { role: 'user', content: toolResults }]
      continue
    }

    finalText = (response.content.find(b => b.type === 'text') as any)?.text ?? ''
    break
  }

  logApiUsage({ companyId, endpoint: 'help-chat', model: 'claude-sonnet-4-6', inputTokens: totalInput, outputTokens: totalOutput }).catch(() => {})

  // Parse bug/suggestion metadata from end of response
  const withoutFences = finalText.replace(/```(?:json)?/g, '').replace(/```/g, '')
  const lastOpen = withoutFences.lastIndexOf('{')
  const lastClose = withoutFences.lastIndexOf('}')
  let isBugReport = false, isSuggestion = false, bugSummary: string | null = null, suggestedActions: string[] = []
  let displayText = finalText

  if (lastOpen !== -1 && lastClose > lastOpen) {
    const jsonStr = withoutFences.slice(lastOpen, lastClose + 1)
    if (jsonStr.includes('isBugReport')) {
      try {
        const meta = JSON.parse(jsonStr)
        isBugReport = meta.isBugReport === true
        isSuggestion = meta.isSuggestion === true
        suggestedActions = Array.isArray(meta.suggestedActions) ? meta.suggestedActions : []
        bugSummary = meta.bugSummary ?? suggestedActions[0] ?? (isSuggestion ? 'User suggestion' : 'Bug report')
        displayText = finalText.slice(0, finalText.lastIndexOf('{')).replace(/```(?:json)?/g, '').replace(/```/g, '').trim()
      } catch {}
    }
  }

  if ((isBugReport || isSuggestion) && bugSummary) {
    const reportType = isSuggestion ? 'suggestion' : 'bug'
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user')?.content ?? ''
    await Promise.allSettled([
      logBugToDb(bugSummary, lastUserMsg, userName, user.email ?? '', user.id, suggestedActions, reportType, companyId),
      sendBugEmail(bugSummary, lastUserMsg, userName, user.email ?? '', suggestedActions, reportType),
    ])
  }

  return NextResponse.json({ message: displayText, isBugReport: isBugReport || isSuggestion })
}
