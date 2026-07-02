import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const WEBHOOK_SECRET = process.env.INBOUND_EMAIL_SECRET
const SITE_ID = '00000000-0000-0000-0000-000000000001'

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
