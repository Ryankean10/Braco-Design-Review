import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

function buildSystemPrompt(industry: string): string {
  const isCivils = industry === 'civils'

  const intro = isCivils
    ? `You are MRRK Assistant — a helpful support bot for the MRRK platform, a construction management tool for civil engineering and grounds works projects in the UK.`
    : `You are MRRK Assistant — a helpful support bot for the MRRK platform, a construction and design review tool for BESS (Battery Energy Storage System) projects in the UK.`

  const whatItDoes = isCivils
    ? `## What MRRK does
MRRK manages civil engineering and grounds works projects through their full lifecycle: Feasibility → Design → Procure → Build & Install → Test & Commission → Handover.`
    : `## What MRRK does
MRRK manages BESS projects through their full lifecycle: Design → Procure → Build & Install → Test & Commission → Energise & Handover.`

  const constructionSection = isCivils
    ? `**Construction page** (/construction)
- Shows all active construction sites
- Click a site to open its full dashboard
- Inside a site: Site Dashboard (crew, weather, open issues, daily logs), Civils activities, ITP panel, Programme, Agency Timesheets`
    : `**Construction page** (/construction)
- Shows all active construction sites (e.g. Dyce BESS, Braco BESS)
- Click a site to open its full dashboard
- Inside a site: Site Dashboard (crew, weather, open issues, daily logs), Cable Register, Civils activities, ITP panel, Programme, Agency Timesheets`

  const planningSection = isCivils
    ? `**Planning / Work Planner** (/planning)
- AI-powered programme forecast generator — input site parameters to get a construction programme
- Free-issue materials can be entered with delivery dates so they are excluded from the critical path`
    : `**Planning / Work Planner** (/planning)
- AI-powered forecast generator — input site parameters, get a programme forecast benchmarked against Dyce BESS real data
- Free-issue materials can be entered with delivery dates so they are excluded from the critical path`

  return `${intro}

${whatItDoes}

## App sections and where to find things

${constructionSection}

**Daily Logs**
- Found inside each construction site page → "Daily logs" section
- Shows the last 7 days of site diary entries with weather, crew, issues and summary
- Civils diaries can be uploaded as PDFs

**Team page** (/team)
- Full staff library — civils crew, subcontractors, site managers
- Click a person to see their profile, credentials, site appointments
- Filter by group

**ITP (Inspection & Test Plan)**
- Found inside each construction site → "ITP" section
- Tracks hold points and witness points for each test activity
- Requires sign-off before moving to next stage

${planningSection}

**Projects** (/projects)
- Upload drawings/documents for AI-assisted review
- Findings classified Critical / Major / Minor / Observation — human sign-off required

**Documents** (/documents)
- Project document library with version control and comment loop

## Bug reporting and suggestions
If the user describes something that isn't working correctly, is broken, shows an error, or behaves unexpectedly — that is a bug. Set isBugReport: true.
If the user makes a suggestion, feature request, or improvement idea — set isSuggestion: true (not isBugReport). Tell them the team will review it.
Both bugs and suggestions are logged and the team is notified.

## Response format
Respond in plain conversational English, 2-4 sentences. At the END output a raw JSON object on its own line — NO markdown, NO code fences, just the object:
{"isBugReport": true/false, "isSuggestion": true/false, "bugSummary": "one sentence or null", "suggestedActions": ["action 1", "action 2"] or []}`
}

const BUG_EMAIL = process.env.ALERT_EMAIL ?? 'admin@safetconsultancy.co.uk'
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'MRRK <onboarding@resend.dev>'

async function sendBugEmail(summary: string, userMessage: string, userName: string, userEmail: string, suggestedActions: string[], reportType: 'bug' | 'suggestion' = 'bug') {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return
  const resend = new Resend(apiKey)
  const actionsHtml = suggestedActions.length
    ? `<ul style="margin:8px 0 0;padding-left:16px;">${suggestedActions.map(a => `<li style="color:#94a3b8;font-size:13px;margin-bottom:4px">${a}</li>`).join('')}</ul>`
    : ''
  const isSuggestion = reportType === 'suggestion'
  await resend.emails.send({
    from: FROM_EMAIL,
    to: BUG_EMAIL,
    subject: isSuggestion
      ? `💡 MRRK Suggestion — ${new Date().toLocaleDateString('en-GB')}`
      : `🐛 MRRK Bug Report — ${new Date().toLocaleDateString('en-GB')}`,
    html: `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,sans-serif">
<div style="max-width:600px;margin:32px auto;background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155">
  <div style="background:${isSuggestion ? '#0ea5e9' : '#8b5cf6'};padding:16px 24px">
    <p style="margin:0;color:#fff;font-weight:700;font-size:15px">${isSuggestion ? '💡 Suggestion' : '🐛 Bug Report'} — MRRK</p>
    <p style="margin:4px 0 0;color:#ddd6fe;font-size:12px">${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}</p>
  </div>
  <div style="padding:20px 24px;display:flex;flex-direction:column;gap:12px">
    <div style="padding:12px 16px;background:#0f172a;border-radius:8px;border-left:3px solid ${isSuggestion ? '#0ea5e9' : '#8b5cf6'}">
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

async function logBugToDb(summary: string, userMessage: string, userName: string, userEmail: string, userId: string, suggestedActions: string[], reportType: 'bug' | 'suggestion' = 'bug') {
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
    report_type: reportType,
    priority: reportType === 'suggestion' ? 'low' : 'medium',
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

  const companySlug = req.headers.get('x-company-slug') ?? 'braco'
  const { data: company } = await supabase.from('companies').select('industry').eq('slug', companySlug).single()
  const industry = (company as any)?.industry ?? 'bess'

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
  const userName = (profile as any)?.full_name ?? user.email ?? 'Unknown user'

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: buildSystemPrompt(industry),
    messages,
  })

  const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
  // Strip any markdown code fence wrapping the JSON block, then extract the JSON object
  const stripped = rawText.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1')
  const jsonMatch = stripped.match(/\{[\s\S]*"isBugReport"[\s\S]*\}/)
  let isBugReport = false
  let isSuggestion = false
  let bugSummary: string | null = null
  let suggestedActions: string[] = []
  // Remove the JSON block (and any wrapping code fence) from display text
  let displayText = rawText.replace(/```(?:json)?\s*\{[\s\S]*?"isBugReport"[\s\S]*?\}\s*```/g, '').trim()
  if (!jsonMatch || displayText === rawText) {
    // Fallback: JSON wasn't in a code fence, strip the bare object
    displayText = jsonMatch ? rawText.replace(jsonMatch[0], '').trim() : rawText
  }

  if (jsonMatch) {
    try {
      const meta = JSON.parse(jsonMatch[0])
      isBugReport = meta.isBugReport === true
      isSuggestion = meta.isSuggestion === true
      bugSummary = meta.bugSummary ?? null
      suggestedActions = meta.suggestedActions ?? []
    } catch {}
  }

  const shouldLog = (isBugReport || isSuggestion) && bugSummary
  if (shouldLog) {
    const reportType = isSuggestion ? 'suggestion' : 'bug'
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user')?.content ?? ''
    Promise.all([
      logBugToDb(bugSummary!, lastUserMsg, userName, user.email ?? '', user.id, suggestedActions, reportType),
      sendBugEmail(bugSummary!, lastUserMsg, userName, user.email ?? '', suggestedActions, reportType),
    ]).catch(e => console.error('Report logging error:', e))
  }

  return NextResponse.json({ message: displayText, isBugReport: isBugReport || isSuggestion, bugSummary })
}
