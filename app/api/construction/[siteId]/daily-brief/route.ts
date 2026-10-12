import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { fetchWeather, generateBriefContent } from '@/lib/daily-brief'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const admin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

async function getSiteContext(siteId: string) {
  const { data: site } = await admin
    .from('construction_sites')
    .select('*, projects(id, name, company_id)')
    .eq('id', siteId)
    .single()
  return site
}

async function buildPersonnel(siteId: string, briefDate: string) {
  // All active appointments for this site
  const { data: appointments } = await admin
    .from('job_appointments')
    .select('*, people(id, name, role, discipline, company, email)')
    .eq('site_id', siteId)
    .or(`start_date.is.null,start_date.lte.${briefDate}`)
    .or(`end_date.is.null,end_date.gte.${briefDate}`)

  if (!appointments?.length) return { personnel: [], holidayAbsences: [] }

  // Approved holidays covering this date
  const personIds = appointments.map((a: any) => a.people?.id).filter(Boolean)
  const { data: holidays } = await admin
    .from('holiday_bookings')
    .select('person_id, people(name)')
    .in('person_id', personIds)
    .eq('status', 'Approved')
    .lte('start_date', briefDate)
    .gte('end_date', briefDate)

  const absentIds = new Set((holidays ?? []).map((h: any) => h.person_id))

  const personnel: { name: string; role: string; company: string; is_manager: boolean }[] = []
  const holidayAbsences: { name: string }[] = []

  for (const appt of appointments ?? []) {
    const person = appt.people
    if (!person) continue
    if (absentIds.has(person.id)) {
      holidayAbsences.push({ name: person.name })
    } else {
      personnel.push({
        name: person.name,
        role: appt.role_on_job || person.role || person.discipline || '',
        company: person.company || '',
        is_manager: appt.is_manager ?? false,
      })
    }
  }

  return { personnel, holidayAbsences }
}

async function getYesterdayIssues(siteId: string, briefDate: string) {
  const yesterday = new Date(briefDate)
  yesterday.setDate(yesterday.getDate() - 1)
  const yDate = yesterday.toISOString().slice(0, 10)

  const { data: log } = await admin
    .from('site_daily_logs')
    .select('issues')
    .eq('site_id', siteId)
    .eq('log_date', yDate)
    .maybeSingle()

  const issues: any[] = log?.issues ?? []
  return issues.filter((i: any) => i.status !== 'Resolved')
}

// GET — fetch brief for a date (defaults to today)
export async function GET(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10)

  const { data: brief } = await admin
    .from('site_daily_briefs')
    .select('*')
    .eq('site_id', siteId)
    .eq('brief_date', date)
    .maybeSingle()

  return NextResponse.json(brief ?? null)
}

// POST — generate (or regenerate) the brief for a date
export async function POST(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const briefDate: string = body.date ?? new Date().toISOString().slice(0, 10)
  const plannedWorks: string = body.plannedWorks ?? ''
  const ramsNotes: string = body.ramsNotes ?? ''
  const thirdParties: string = body.thirdParties ?? ''

  const site = await getSiteContext(siteId)
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })

  const [{ personnel, holidayAbsences }, issuesCarriedOver, weather] = await Promise.all([
    buildPersonnel(siteId, briefDate),
    getYesterdayIssues(siteId, briefDate),
    fetchWeather(site.location ?? site.name),
  ])

  const { hsFact, aiSummary } = await generateBriefContent({
    siteName: site.name,
    briefDate,
    plannedWorks,
    personnel,
    holidayAbsences,
    issuesCarriedOver,
    weather,
    thirdParties,
  })

  const { data: brief, error } = await admin
    .from('site_daily_briefs')
    .upsert({
      site_id: siteId,
      brief_date: briefDate,
      planned_works: plannedWorks,
      rams_notes: ramsNotes,
      third_parties: thirdParties,
      personnel_on_site: personnel,
      holiday_absences: holidayAbsences,
      issues_carried_over: issuesCarriedOver,
      weather,
      hs_fact: hsFact,
      ai_summary: aiSummary,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'site_id,brief_date' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(brief)
}

// PATCH — update editable fields only (no regeneration)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { date, plannedWorks, ramsNotes, thirdParties } = await req.json()
  const briefDate: string = date ?? new Date().toISOString().slice(0, 10)

  const { data: brief, error } = await admin
    .from('site_daily_briefs')
    .update({
      planned_works: plannedWorks,
      rams_notes: ramsNotes,
      third_parties: thirdParties,
      updated_at: new Date().toISOString(),
    })
    .eq('site_id', siteId)
    .eq('brief_date', briefDate)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(brief)
}
