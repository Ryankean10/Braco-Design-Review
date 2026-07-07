import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { Resend } from 'resend'

const WEBHOOK_SECRET = process.env.INBOUND_EMAIL_SECRET
const SITE_ID = '00000000-0000-0000-0000-000000000001'
const ALERT_EMAIL = process.env.ALERT_EMAIL ?? 'admin@safetconsultancy.co.uk'
// Use Resend's default sending domain until gridgate.ai is verified in Resend dashboard
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'GridGate <onboarding@resend.dev>'

async function sendHighImpactAlert(parsed: any) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  const highIssues: any[] = (parsed.issues ?? []).filter((i: any) =>
    i.impact === 'High' || i.impact === 'Critical'
  )
  const highWeather = parsed.weather_impact === 'High' || parsed.weather_impact === 'Critical'

  if (!highIssues.length && !highWeather) return

  const resend = new Resend(apiKey)

  const issueRows = highIssues.map((i: any) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #334155;color:#f87171;font-weight:600">${i.impact}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #334155;color:#e2e8f0">${i.description}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #334155;color:#94a3b8">${i.action ?? '—'}</td>
    </tr>`).join('')

  const weatherRow = highWeather ? `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #334155;color:#fb923c;font-weight:600">Weather — ${parsed.weather_impact}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #334155;color:#e2e8f0">${parsed.weather_description ?? ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #334155;color:#94a3b8">Lost hours: ${parsed.weather_lost_hours ?? 0}h</td>
    </tr>` : ''

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155">
    <div style="background:#f87171;padding:16px 24px;display:flex;align-items:center;gap:12px">
      <span style="font-size:20px">⚠️</span>
      <div>
        <p style="margin:0;color:#fff;font-weight:700;font-size:15px">High Impact Issue — Dyce BESS</p>
        <p style="margin:4px 0 0;color:#fecaca;font-size:12px">${new Date(parsed.log_date).toLocaleDateString('en-GB', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}</p>
      </div>
    </div>

    <div style="padding:20px 24px">
      <p style="margin:0 0 16px;color:#94a3b8;font-size:13px">The following high or critical impact items were identified in today's site diary for <strong style="color:#e2e8f0">Dyce BESS</strong>:</p>

      <table style="width:100%;border-collapse:collapse;background:#0f172a;border-radius:8px;overflow:hidden;font-size:13px">
        <thead>
          <tr>
            <th style="padding:8px 12px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #334155">Severity</th>
            <th style="padding:8px 12px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #334155">Description</th>
            <th style="padding:8px 12px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #334155">Action</th>
          </tr>
        </thead>
        <tbody>${weatherRow}${issueRows}</tbody>
      </table>

      <div style="margin-top:16px;padding:14px 16px;background:#0f172a;border-radius:8px;border-left:3px solid #64748b">
        <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.05em">Today's Summary</p>
        <p style="margin:0;color:#e2e8f0;font-size:13px;line-height:1.6">${parsed.summary ?? 'No summary available.'}</p>
      </div>

      <div style="margin-top:20px;text-align:center">
        <a href="https://braco-design-review.vercel.app/construction/${SITE_ID}?date=${parsed.log_date}#issues"
          style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:600">
          View Issue in GridGate →
        </a>
      </div>
    </div>

    <div style="padding:12px 24px;border-top:1px solid #334155;text-align:center">
      <p style="margin:0;color:#475569;font-size:11px">GridGate · Dyce BESS Site · Automated alert</p>
    </div>
  </div>
</body>
</html>`

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to: ALERT_EMAIL,
    subject: `⚠️ High Impact Issue — Dyce BESS ${parsed.log_date}`,
    html,
  })
  console.log('Alert email sent:', JSON.stringify(result))
}

const SYSTEM_PROMPT = `You are a construction data extractor for a BESS site in Dyce, Aberdeen.
Extract structured data from daily progress emails sent by the site construction manager (Stuart Paterson, OCU Group).

Cable reference conventions:
- AC Battery cables: P202-x through P205-x (where x = MVS number 1-8)
- 5C 70mm² skid cables: P201-x (where x = MVS number)
- LV Power mains: P200-1L1, P200-1L2, P200-1L3, P200-1N, P200-2L1 etc.

Activity types: Pull, Gland, Crimp, Terminate, Test, Torque, Label
End sides: "Transformer side" / "Battery side" / "MVS side" / "Skid side" / "Aux TX side"

"All tested" for an MVS means Test activity for cables P202-x through P205-x (and P201-x) for that MVS.

Return ONLY valid JSON:
{
  "log_date": "YYYY-MM-DD",
  "weather_description": "string or null",
  "weather_conditions": "Good|Fair|Poor|null",
  "weather_lost_hours": 0,
  "weather_impact": "None|Low|Medium|High",
  "personnel": [
    { "name": "string", "role": "Electrician|Apprentice|Site Manager|Engineer|Other", "company": "OCU|IPE|Other", "hours": number, "note": "string or null" }
  ],
  "cable_updates": [
    { "cable_ref": "string", "activities_completed": ["Pull"|"Gland"|"Crimp"|"Terminate"|"Test"|"Torque"|"Label"], "end_side": "string or null", "notes": "string or null" }
  ],
  "issues": [
    { "description": "string", "impact": "Low|Medium|High|Critical", "status": "Open|Closed", "action": "string or null" }
  ],
  "summary": "string"
}

Estimate 10 hours per person unless email states otherwise. Deduct for early departures/late arrivals from 07:00 start.`

function normaliseRef(ref: string): string {
  const skid = ref.match(/^P201-(\d+)$/)
  if (skid) return `5C70-MVS${skid[1]}-01`
  const ac = ref.match(/^P(20[2-5])-(\d+)$/)
  if (ac) return `P${parseInt(ac[1]) + 100}-${ac[2]}`
  return ref
}

export async function POST(req: NextRequest) {
  // Verify secret
  const secret = req.headers.get('x-webhook-secret')
  if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const emailBody: string = body.emailBody
  const subject: string = body.subject ?? ''

  if (!emailBody?.trim()) {
    return NextResponse.json({ error: 'No email body provided' }, { status: 400 })
  }

  // Only process cable progress emails
  if (!/cable progress|electricians progress|progress/i.test(subject)) {
    return NextResponse.json({ skipped: true, reason: 'Subject does not match site report pattern' })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  // Parse with Claude
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Subject: ${subject}\n\n${emailBody}` }]
  })

  const text = (msg.content[0] as any).text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  let parsed: any
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    console.error('Parse error:', e, 'Raw:', text.slice(0, 200))
    return NextResponse.json({ error: 'Failed to parse Claude response' }, { status: 500 })
  }

  // Upsert daily log
  const totalManhours = parsed.personnel.reduce((s: number, p: any) => s + (p.hours ?? 10), 0)
  const { error: logError } = await sb.from('site_daily_logs').upsert({
    site_id: SITE_ID,
    log_date: parsed.log_date,
    personnel: parsed.personnel,
    total_manhours: totalManhours,
    weather_description: parsed.weather_description,
    weather_conditions: parsed.weather_conditions,
    weather_lost_hours: parsed.weather_lost_hours ?? 0,
    weather_impact: parsed.weather_impact ?? 'None',
    issues: parsed.issues ?? [],
    summary: parsed.summary,
    source: 'email',
    raw_email_body: emailBody,
  }, { onConflict: 'site_id,log_date' })

  if (logError) {
    console.error('Log upsert error:', logError)
    return NextResponse.json({ error: logError.message }, { status: 500 })
  }

  // Send high-impact alert email (non-blocking — don't fail the request if email fails)
  sendHighImpactAlert(parsed).catch(e => console.error('Alert email error:', e))

  // Apply cable activity updates
  const cableUpdates: any[] = parsed.cable_updates ?? []
  let activitiesUpdated = 0
  const notFound: string[] = []

  if (cableUpdates.length) {
    const rawRefs = [...new Set(cableUpdates.map((u: any) => u.cable_ref as string))]
    const normMap = Object.fromEntries(rawRefs.map(r => [normaliseRef(r), r]))
    const { data: cableRows } = await sb.from('cable_items')
      .select('id, cable_ref').eq('site_id', SITE_ID).in('cable_ref', Object.keys(normMap))
    const idMap = Object.fromEntries((cableRows ?? []).map((r: any) => [normMap[r.cable_ref], r.id]))

    for (const update of cableUpdates) {
      const cableId = idMap[update.cable_ref]
      if (!cableId) { notFound.push(update.cable_ref); continue }

      for (const activity of update.activities_completed) {
        const endSide = update.end_side ?? null
        const q = sb.from('cable_activities')
          .update({ status: 'Complete', completed_by: 'Site team', completed_at: new Date(parsed.log_date).toISOString() })
          .eq('cable_id', cableId).eq('activity', activity)
        const { error } = endSide ? await q.eq('end_side', endSide) : await q.is('end_side', null)
        if (!error) activitiesUpdated++
      }

      if (update.notes) {
        await sb.from('cable_items').update({ notes: update.notes, overall_status: 'In Progress' }).eq('id', cableId)
      }

      // Recompute completion_pct
      const { data: acts } = await sb.from('cable_activities').select('status').eq('cable_id', cableId)
      if (acts?.length) {
        const pct = acts.filter((a: any) => a.status === 'Complete').length / acts.length
        await sb.from('cable_items').update({
          completion_pct: pct,
          overall_status: pct >= 1 ? 'Complete' : pct > 0 ? 'In Progress' : 'Not Started'
        }).eq('id', cableId)
      }
    }
  }

  return NextResponse.json({
    success: true,
    log_date: parsed.log_date,
    personnel: parsed.personnel.length,
    total_manhours: totalManhours,
    cable_updates: cableUpdates.length,
    activities_updated: activitiesUpdated,
    not_found: notFound.length ? [...new Set(notFound)] : undefined,
  })
}
