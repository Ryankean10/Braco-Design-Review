import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const SYSTEM_PROMPT = `You are GridGate Assistant — a helpful support bot for the GridGate platform, a construction and design review tool for BESS (Battery Energy Storage System) projects in the UK.

## What GridGate does
GridGate manages BESS projects through their full lifecycle: Design → Procure → Build & Install → Test & Commission → Energise & Handover.

## App sections and where to find things

**Construction page** (/construction)
- Shows all active construction sites (e.g. Dyce BESS, Braco BESS)
- Click a site to open its full dashboard
- Inside a site: Site Dashboard (crew, weather, open issues, daily logs), Cable Register, Civils activities, ITP panel, Programme, Agency Timesheets

**Daily Logs**
- Found inside each construction site page → "Daily logs" section
- Shows the last 7 days of site diary entries with weather, crew, issues and summary
- Electricians progress emails are automatically ingested each evening
- Civils diaries can be uploaded as PDFs

**Team page** (/team)
- Full staff library — OCU staff, agency electricians, civils crew, subcontractors
- Click a person to see their profile, credentials, site appointments
- Filter by group (Agency Staff, OCU Civils Staff, Project Staff, etc.)

**Cable Register**
- Found inside each construction site → "Cable Register" tab
- Shows all cables with status (Not Started / In Progress / Complete), completion %, flagged items
- Tracks individual activities: Pull, Gland, Crimp, Terminate, Test, Torque, Label

**ITP (Inspection & Test Plan)**
- Found inside each construction site → "ITP" section
- Tracks hold points and witness points for each test activity
- Requires sign-off before moving to next stage

**Planning / Work Planner** (/planning)
- AI-powered forecast generator — input site parameters, get a programme forecast benchmarked against Dyce BESS real data
- Free-issue materials can be entered with delivery dates so they are excluded from the critical path

**Design Review** (/projects)
- Upload drawings/documents for AI-assisted review against 6 lenses
- Findings classified Critical / Major / Minor / Observation — human sign-off required

**Documents** (/documents)
- Project document library with version control and comment loop

## Bug reporting
If the user describes something that isn't working correctly, is broken, shows an error, or behaves unexpectedly — that is a bug.

## Response format
Respond in plain conversational English, 2-4 sentences. At the END output a JSON block on its own line:
{"isBugReport": true/false, "bugSummary": "one sentence or null", "suggestedActions": ["action 1", "action 2"] or []}`

const BUG_EMAIL = process.env.ALERT_EMAIL ?? 'admin@safetconsultancy.co.uk'
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'GridGate <onboarding@resend.dev>'

async function sendBugEmail(summary: string, userMessage: string, userName: string, userEmail: string, suggestedActions: string[]) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return
  const resend = new Resend(apiKey)
  const actionsHtml = suggestedActions.length
    ? `<ul style="margin:8px 0 0;padding-left:16px;">${suggestedActions.map(a => `<li style="color:#94a3b8;font-size:13px;margin-bottom:4px">${a}</li>`).join('')}</ul>`
    : ''
  await resend.emails.send({
    from: FROM_EMAIL,
    to: BUG_EMAIL,
    subject: `🐛 GridGate Bug Report — ${new Date().toLocaleDateString('en-GB')}`,
    html: `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,sans-serif">
<div style="max-width:600px;margin:32px auto;background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155">
  <div style="background:#8b5cf6;padding:16px 24px">
    <p style="margin:0;color:#fff;font-weight:700;font-size:15px">🐛 Bug Report — GridGate</p>
    <p style="margin:4px 0 0;color:#ddd6fe;font-size:12px">${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}</p>
  </div>
  <div style="padding:20px 24px;display:flex;flex-direction:column;gap:12px">
    <div style="padding:12px 16px;background:#0f172a;border-radius:8px;border-left:3px solid #8b5cf6">
      <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.05em">Reported by</p>
      <p style="margin:0;color:#e2e8f0;font-size:13px">${userName}${userEmail ? ` &lt;${userEmail}&gt;` : ''}</p>
    </div>
    <div style="padding:12px 16px;background:#0f172a;border-radius:8px;border-left:3px solid #f87171">
      <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.05em">Issue</p>
      <p style="margin:0;color:#e2e8f0;font-size:13px">${summary}</p>
    </div>
    <div style="padding:12px 16px;background:#0f172a;border-radius:8px;border-left:3px solid #64748b">
      <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.05em">Full message</p>
      <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6">${userMessage}</p>
    </div>
    ${suggestedActions.length ? `
    <div style="padding:12px 16px;background:#0f172a;border-radius:8px;border-left:3px solid #10b981">
      <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.05em">Suggested actions</p>
      ${actionsHtml}
    </div>` : ''}
    <div style="text-align:center;margin-top:8px">
      <a href="https://braco-design-review.vercel.app/admin/bugs"
        style="display:inline-block;background:#8b5cf6;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:600">
        View in Admin Panel →
      </a>
    </div>
  </div>
</div></body></html>`
  })
}

async function logBugToDb(summary: string, userMessage: string, userName: string, userEmail: string, userId: string, suggestedActions: string[]) {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  await sb.from('bug_reports').insert({
    reporter_id: userId,
    reporter_name: userName,
    reporter_email: userEmail,
    user_message: userMessage,
    summary,
    suggested_actions: suggestedActions,
    status: 'open',
  })
}

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

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
  const userName = (profile as any)?.full_name ?? user.email ?? 'Unknown user'

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages,
  })

  const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = rawText.match(/\{[\s\S]*"isBugReport"[\s\S]*\}/)
  let isBugReport = false
  let bugSummary: string | null = null
  let suggestedActions: string[] = []
  let displayText = rawText

  if (jsonMatch) {
    try {
      const meta = JSON.parse(jsonMatch[0])
      isBugReport = meta.isBugReport === true
      bugSummary = meta.bugSummary ?? null
      suggestedActions = meta.suggestedActions ?? []
    } catch {}
    displayText = rawText.replace(jsonMatch[0], '').trim()
  }

  if (isBugReport && bugSummary) {
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user')?.content ?? ''
    Promise.all([
      logBugToDb(bugSummary, lastUserMsg, userName, user.email ?? '', user.id, suggestedActions),
      sendBugEmail(bugSummary, lastUserMsg, userName, user.email ?? '', suggestedActions),
    ]).catch(e => console.error('Bug report error:', e))
  }

  return NextResponse.json({ message: displayText, isBugReport, bugSummary })
}
