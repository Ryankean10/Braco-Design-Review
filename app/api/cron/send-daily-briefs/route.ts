import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { fetchWeather, generateBriefContent, formatBriefEmail } from '@/lib/daily-brief'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const admin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)
const resend = new Resend(process.env.RESEND_API_KEY)

async function buildPersonnel(siteId: string, briefDate: string) {
  const { data: appointments } = await admin
    .from('job_appointments')
    .select('*, people(id, name, role, discipline, company, email)')
    .eq('site_id', siteId)
    .or(`start_date.is.null,start_date.lte.${briefDate}`)
    .or(`end_date.is.null,end_date.gte.${briefDate}`)

  if (!appointments?.length) return { personnel: [], holidayAbsences: [], managerEmails: [] }

  const personIds = appointments.map((a: any) => a.people?.id).filter(Boolean)
  const { data: holidays } = await admin
    .from('holiday_bookings')
    .select('person_id')
    .in('person_id', personIds)
    .eq('status', 'Approved')
    .lte('start_date', briefDate)
    .gte('end_date', briefDate)

  const absentIds = new Set((holidays ?? []).map((h: any) => h.person_id))

  const personnel: { name: string; role: string; company: string; is_manager: boolean }[] = []
  const holidayAbsences: { name: string }[] = []
  const managerEmails: string[] = []

  for (const appt of appointments) {
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
      if (appt.is_manager && person.email) managerEmails.push(person.email)
    }
  }

  return { personnel, holidayAbsences, managerEmails }
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

  return ((log?.issues ?? []) as any[]).filter((i: any) => i.status !== 'Resolved')
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const results: string[] = []

  // Get all active sites with company from_email
  const { data: sites } = await admin
    .from('construction_sites')
    .select('id, name, location, project_id, projects(company_id, companies(from_email, name))')
    .eq('status', 'active')

  if (!sites?.length) return NextResponse.json({ ok: true, results: ['No active sites'] })

  for (const site of sites) {
    try {
      // Skip if brief already sent today
      const { data: existing } = await admin
        .from('site_daily_briefs')
        .select('id, status, planned_works, rams_notes, third_parties')
        .eq('site_id', site.id)
        .eq('brief_date', today)
        .maybeSingle()

      if (existing?.status === 'sent') {
        results.push(`${site.name}: already sent`)
        continue
      }

      const [{ personnel, holidayAbsences, managerEmails }, issuesCarriedOver, weather] = await Promise.all([
        buildPersonnel(site.id, today),
        getYesterdayIssues(site.id, today),
        fetchWeather(site.location ?? site.name),
      ])

      const plannedWorks = existing?.planned_works ?? ''
      const ramsNotes = existing?.rams_notes ?? ''
      const thirdParties = existing?.third_parties ?? ''

      const { hsFact, aiSummary } = await generateBriefContent({
        siteName: site.name,
        briefDate: today,
        plannedWorks,
        personnel,
        holidayAbsences,
        issuesCarriedOver,
        weather,
        thirdParties,
      })

      // Upsert the brief
      const { data: brief } = await admin
        .from('site_daily_briefs')
        .upsert({
          site_id: site.id,
          brief_date: today,
          planned_works: plannedWorks,
          rams_notes: ramsNotes,
          third_parties: thirdParties,
          personnel_on_site: personnel,
          holiday_absences: holidayAbsences,
          issues_carried_over: issuesCarriedOver,
          weather,
          hs_fact: hsFact,
          ai_summary: aiSummary,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'site_id,brief_date' })
        .select('id')
        .single()

      // Send email if there are manager recipients
      if (managerEmails.length > 0) {
        const project = (site as any).projects
        const company = project?.companies
        const fromEmail = company?.from_email ?? 'scotplantai@yacht-gitana.com'
        const fromName = company?.name ?? 'Site Management'

        const briefUrl = `https://braco.yacht-gitana.com/construction/${site.id}/daily-brief`
        const { subject, html, text } = formatBriefEmail({
          siteName: site.name,
          briefDate: today,
          personnel,
          holidayAbsences,
          thirdParties,
          plannedWorks,
          ramsNotes,
          issuesCarriedOver,
          weather,
          hsFact,
          aiSummary,
          briefUrl,
        })

        await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: managerEmails,
          subject,
          html,
          text,
        })

        await admin.from('site_daily_briefs')
          .update({ status: 'sent', email_sent_at: new Date().toISOString() })
          .eq('id', brief!.id)

        results.push(`${site.name}: brief generated + sent to ${managerEmails.join(', ')}`)
      } else {
        results.push(`${site.name}: brief generated (no manager emails configured)`)
      }
    } catch (err: any) {
      results.push(`${site.name}: ERROR — ${err.message}`)
    }
  }

  return NextResponse.json({ ok: true, results })
}
