import { NextRequest, NextResponse } from 'next/server'
import { requireRole, MANAGER_ROLES } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { getResendClient } from '@/lib/resend'
import { headers } from 'next/headers'

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const auth = await requireRole(MANAGER_ROLES)
  if ('error' in auth) return auth.error

  const { date, company_id } = await req.json()
  const headersList = await headers()
  const companySlug = headersList.get('x-company-slug') ?? null
  const { resend, fromEmail } = getResendClient(companySlug)

  // Get all tasks for the date, grouped by driver
  const { data: tasks } = await admin()
    .from('haulage_tasks')
    .select('*, people(id, name, email), haulage_vehicles(name, reg), projects(name)')
    .eq('company_id', company_id)
    .eq('task_date', date)
    .order('sort_order')

  if (!tasks?.length) return NextResponse.json({ error: 'No tasks for this date' }, { status: 400 })

  // Group by driver
  const byDriver = new Map<string, { driver: any; tasks: any[] }>()
  for (const t of tasks) {
    const p = t.people as any
    if (!p?.id || !p?.email) continue
    if (!byDriver.has(p.id)) byDriver.set(p.id, { driver: p, tasks: [] })
    byDriver.get(p.id)!.tasks.push(t)
  }

  if (byDriver.size === 0) return NextResponse.json({ error: 'No tasks have drivers with email addresses assigned' }, { status: 400 })

  const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  let count = 0

  for (const { driver, tasks: dTasks } of byDriver.values()) {
    const taskRows = dTasks.map((t: any, i: number) => `
      <tr style="border-bottom:1px solid #1e293b">
        <td style="padding:10px 12px;color:#94a3b8;font-size:13px">${i + 1}</td>
        <td style="padding:10px 12px">
          <p style="margin:0;font-weight:600;color:#f1f5f9;font-size:13px">${t.title}</p>
          ${t.description ? `<p style="margin:4px 0 0;color:#94a3b8;font-size:12px">${t.description}</p>` : ''}
          ${t.location ? `<p style="margin:4px 0 0;color:#94a3b8;font-size:12px">📍 ${t.location}</p>` : ''}
        </td>
        <td style="padding:10px 12px;color:#94a3b8;font-size:12px">${t.haulage_vehicles ? `${(t.haulage_vehicles as any).name}${(t.haulage_vehicles as any).reg ? ` (${(t.haulage_vehicles as any).reg})` : ''}` : '—'}</td>
        <td style="padding:10px 12px;color:#94a3b8;font-size:12px">${t.projects ? (t.projects as any).name : 'Ad-hoc'}</td>
        <td style="padding:10px 12px;color:#94a3b8;font-size:12px">${t.est_start && t.est_end ? `${t.est_start.slice(0,5)} – ${t.est_end.slice(0,5)}` : '—'}</td>
      </tr>`).join('')

    const html = `
      <div style="font-family:sans-serif;background:#0f172a;padding:32px;max-width:640px;margin:0 auto;border-radius:12px">
        <h2 style="color:#f1f5f9;margin:0 0 4px">Daily task brief</h2>
        <p style="color:#94a3b8;margin:0 0 24px;font-size:14px">${displayDate}</p>
        <p style="color:#f1f5f9;font-size:14px">Hi ${driver.name.split(' ')[0]},</p>
        <p style="color:#94a3b8;font-size:14px;margin-bottom:20px">Here are your tasks for today. Please <strong style="color:#f1f5f9">reply to this email at the end of the day</strong> with the times you started and finished each task, and note any additional work you carried out.</p>

        <table style="width:100%;border-collapse:collapse;background:#1e293b;border-radius:8px;overflow:hidden;margin-bottom:24px">
          <thead>
            <tr style="background:#334155">
              <th style="padding:10px 12px;text-align:left;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase">#</th>
              <th style="padding:10px 12px;text-align:left;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase">Task</th>
              <th style="padding:10px 12px;text-align:left;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase">Vehicle</th>
              <th style="padding:10px 12px;text-align:left;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase">Job</th>
              <th style="padding:10px 12px;text-align:left;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase">Est. times</th>
            </tr>
          </thead>
          <tbody>${taskRows}</tbody>
        </table>

        <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px;margin-bottom:24px">
          <p style="color:#f1f5f9;font-size:13px;font-weight:600;margin:0 0 8px">How to report your day</p>
          <p style="color:#94a3b8;font-size:13px;margin:0">Reply to this email with something like:</p>
          <p style="color:#e2e8f0;font-size:13px;margin:12px 0 0;font-style:italic">
            "Task 1 – Dyce delivery: 07:30 to 10:00<br>
            Task 2 – Yard pickup for Kilwinning: 10:30 to 12:00<br>
            Also helped unload at Braco yard: 13:00 to 14:30 (extra job, not on the list)"
          </p>
        </div>
        <p style="color:#475569;font-size:12px">If you need to report a breakdown or problem, include it in your reply and we'll pick it up.</p>
      </div>`

    const { error } = await resend.emails.send({
      from: fromEmail,
      to: driver.email,
      subject: `Your task brief — ${displayDate}`,
      html,
      text: `Daily task brief for ${displayDate}\n\nTasks:\n${dTasks.map((t: any, i: number) => `${i + 1}. ${t.title}${t.location ? ` @ ${t.location}` : ''}${t.est_start ? ` (${t.est_start.slice(0,5)}–${t.est_end?.slice(0,5) ?? '?'})` : ''}`).join('\n')}\n\nReply with times for each task at end of day.`,
    })

    if (!error) {
      // Upsert a pending sheet for this driver
      await admin().from('haulage_daily_sheets').upsert({
        company_id,
        driver_id: driver.id,
        sheet_date: date,
        status: 'pending',
        brief_sent_at: new Date().toISOString(),
      }, { onConflict: 'driver_id,sheet_date' })
      count++
    }
  }

  return NextResponse.json({ ok: true, count })
}
