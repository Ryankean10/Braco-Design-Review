import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

export async function POST(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()

  // Compute total manhours from personnel array
  const personnel = body.personnel ?? []
  const total_manhours = personnel.reduce((sum: number, p: any) => {
    const n = parseFloat(p.number_on_site ?? p.count ?? 1)
    const h = parseFloat(p.hours ?? 0)
    return sum + (n * h)
  }, 0)

  const { data, error } = await supabase
    .from('site_daily_logs')
    .upsert({
      site_id: siteId,
      log_date: body.log_date,
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
  return NextResponse.json(data, { status: 201 })
}
