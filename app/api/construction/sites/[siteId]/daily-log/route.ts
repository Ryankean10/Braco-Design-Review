export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export async function GET(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') ?? '30')

  const { data, error } = await supabase
    .from('site_daily_logs')
    .select('*')
    .eq('site_id', siteId)
    .order('log_date', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function runAiAnalysis(logId: string, body: any) {
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const prompt = `You are analysing a construction site daily log entry. Extract and return structured data.

LOG DATE: ${body.log_date}
SUMMARY: ${body.summary ?? '(none)'}
WEATHER: ${body.weather_conditions ?? ''} ${body.weather_description ?? ''}, impact: ${body.weather_impact ?? 'None'}
WEATHER LOST HOURS: ${body.weather_lost_hours ?? 0}

PERSONNEL AS ENTERED:
${(body.personnel ?? []).map((p: any) =>
  `- ${p.name || '(unnamed)'} | ${p.role} | ${p.company} | ${p.hours ?? 0}h${p.note ? ' | ' + p.note : ''}`
).join('\n') || '(none)'}

ISSUES AS ENTERED:
${(body.issues ?? []).map((i: any) =>
  `- [${i.impact}] ${i.description} | Action: ${i.action || '(none)'} | Status: ${i.status}`
).join('\n') || '(none)'}

Your tasks:
1. ISSUES: Merge entered issues with any additional issues identifiable from the summary. Do not duplicate. Add an "owner" field where identifiable.
2. PERSONNEL: Clean up the entered personnel list (fix obvious name typos, normalise roles). Check if summary mentions anyone not in the list and add them. Flag timesheet anomalies.
3. TIMESHEET: Calculate total_manhours as sum of all personnel hours.
4. FLAGS: Return concise list of concerns (e.g. "John Smith logged 14h — verify", "Issue raised with no action owner", "Weather impact High but no lost hours recorded").

Respond with ONLY valid JSON in this exact shape:
{
  "issues": [{"description": "", "impact": "Low|Medium|High", "action": "", "owner": "", "status": "Open|Closed"}],
  "personnel": [{"name": "", "role": "", "company": "", "hours": 0, "note": ""}],
  "total_manhours": 0,
  "ai_flags": ["..."]
}`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return

    const parsed = JSON.parse(jsonMatch[0])

    await service.from('site_daily_logs').update({
      issues:        Array.isArray(parsed.issues) ? parsed.issues : body.issues ?? [],
      personnel:     Array.isArray(parsed.personnel) ? parsed.personnel : body.personnel ?? [],
      total_manhours: typeof parsed.total_manhours === 'number' ? parsed.total_manhours : body.total_manhours,
      ai_flags:      Array.isArray(parsed.ai_flags) ? parsed.ai_flags : [],
      updated_at:    new Date().toISOString(),
    }).eq('id', logId)
  } catch (e) {
    console.error('AI analysis failed for log', logId, e)
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()

  const personnel      = body.personnel ?? []
  const total_manhours = personnel.reduce((s: number, p: any) => s + (Number(p.hours) || 0), 0)

  // Save immediately
  const { data, error } = await supabase
    .from('site_daily_logs')
    .upsert({
      site_id:             siteId,
      log_date:            body.log_date,
      personnel,
      total_manhours,
      weather_description: body.weather_description ?? null,
      weather_conditions:  body.weather_conditions ?? null,
      temp_c:              body.temp_c ?? null,
      wind_mph:            body.wind_mph ?? null,
      rain_mm:             body.rain_mm ?? null,
      weather_lost_hours:  body.weather_lost_hours ?? 0,
      weather_impact:      body.weather_impact ?? null,
      issues:              body.issues ?? [],
      summary:             body.summary ?? null,
      source:              body.source ?? 'manual',
      raw_email_body:      body.raw_email_body ?? null,
      submitted_by:        user.id,
      updated_at:          new Date().toISOString(),
    }, { onConflict: 'site_id,log_date' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fire AI analysis in background — does not block the response
  runAiAnalysis(data.id, { ...body, total_manhours })

  return NextResponse.json({ ...data, ai_flags: [] }, { status: 201 })
}
