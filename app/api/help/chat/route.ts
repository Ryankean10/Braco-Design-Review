import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'
import { createServerClient } from '@supabase/ssr'
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
- Upload drawings/documents for AI-assisted review against 6 lenses: Standards & Compliance, Employer's Requirements, Constructability, Procurement, Testing & Commissioning, Civils & Temporary Works
- Findings are classified Critical / Major / Minor / Observation
- Human sign-off required on all findings

**Documents** (/documents)
- Project document library with version control and comment loop between designer and reviewer

**Settings / Profile**
- Top-right avatar → profile settings, role shown there

## Bug reporting
If the user describes something that isn't working correctly, is broken, shows an error, or behaves unexpectedly — that is a bug. Extract a clear summary of:
1. What they were trying to do
2. What happened instead
3. Which page/section it occurred on

## Response format
Always respond in plain conversational English. Keep answers concise (2-4 sentences max unless a longer explanation is needed). If you cannot answer something, say so honestly.

At the END of your response, output a JSON block on its own line in this exact format — do not include it in your conversational reply:
{"isBugReport": true/false, "bugSummary": "one sentence description or null"}`

const BUG_EMAIL = process.env.ALERT_EMAIL ?? 'admin@safetconsultancy.co.uk'
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'GridGate <onboarding@resend.dev>'

async function sendBugReport(bugSummary: string, userMessage: string, userName: string, userEmail: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  const resend = new Resend(apiKey)
  await resend.emails.send({
    from: FROM_EMAIL,
    to: BUG_EMAIL,
    subject: `🐛 GridGate Bug Report — ${new Date().toLocaleDateString('en-GB')}`,
    html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155">
    <div style="background:#8b5cf6;padding:16px 24px">
      <p style="margin:0;color:#fff;font-weight:700;font-size:15px">🐛 Bug Report — GridGate</p>
      <p style="margin:4px 0 0;color:#ddd6fe;font-size:12px">${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}</p>
    </div>
    <div style="padding:20px 24px">
      <div style="margin-bottom:16px;padding:12px 16px;background:#0f172a;border-radius:8px;border-left:3px solid #8b5cf6">
        <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.05em">Reported by</p>
        <p style="margin:0;color:#e2e8f0;font-size:13px">${userName}${userEmail ? ` &lt;${userEmail}&gt;` : ''}</p>
      </div>
      <div style="margin-bottom:16px;padding:12px 16px;background:#0f172a;border-radius:8px;border-left:3px solid #f87171">
        <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.05em">Issue Summary</p>
        <p style="margin:0;color:#e2e8f0;font-size:13px">${bugSummary}</p>
      </div>
      <div style="padding:12px 16px;background:#0f172a;border-radius:8px;border-left:3px solid #64748b">
        <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.05em">Full message</p>
        <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6">${userMessage}</p>
      </div>
      <div style="margin-top:20px;text-align:center">
        <a href="https://braco-design-review.vercel.app"
          style="display:inline-block;background:#8b5cf6;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:600">
          Open GridGate →
        </a>
      </div>
    </div>
  </div>
</body>
</html>`
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

  // Get user profile for bug reports
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
  const userName = (profile as any)?.full_name ?? user.email ?? 'Unknown user'

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages,
  })

  const rawText = response.content[0].type === 'text' ? response.content[0].text : ''

  // Extract the JSON metadata line
  const jsonMatch = rawText.match(/\{"isBugReport":[^}]+\}/)
  let isBugReport = false
  let bugSummary = null
  let displayText = rawText

  if (jsonMatch) {
    try {
      const meta = JSON.parse(jsonMatch[0])
      isBugReport = meta.isBugReport === true
      bugSummary = meta.bugSummary ?? null
    } catch {}
    displayText = rawText.replace(jsonMatch[0], '').trim()
  }

  // Fire bug report email non-blocking
  if (isBugReport && bugSummary) {
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user')?.content ?? ''
    sendBugReport(bugSummary, lastUserMsg, userName, user.email ?? '').catch(e =>
      console.error('Bug report email error:', e)
    )
  }

  return NextResponse.json({ message: displayText, isBugReport, bugSummary })
}
