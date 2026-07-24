import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: profile } = await admin.from('profiles').select('role, full_name, company_id').eq('id', user.id).single()
  const role = profile?.role ?? ''
  const byName = profile?.full_name ?? 'Unknown'

  const { personId, weekStarting, action, notes } = await req.json()

  if (action === 'Approved' || action === 'Rejected') {
    if (!['admin', 'superadmin', 'project_manager'].includes(role)) {
      return NextResponse.json({ error: 'Only admin or PM can sign off timesheets' }, { status: 403 })
    }
  }

  const { data: existing } = await admin.from('weekly_timesheets')
    .select('id, status, sign_off_history, bonus')
    .eq('person_id', personId)
    .eq('week_starting', weekStarting)
    .maybeSingle()

  const previousStatus = existing?.status ?? 'Draft'

  if (previousStatus === 'Approved' && !['admin', 'superadmin'].includes(role)) {
    return NextResponse.json({ error: 'Only admin can override an approved timesheet' }, { status: 403 })
  }

  const historyEntry = {
    action, status: action, by_id: user.id, by_name: byName,
    at: new Date().toISOString(), notes: notes || null, previous_status: previousStatus,
  }

  const patch: Record<string, unknown> = {
    status: action,
    sign_off_history: [...(existing?.sign_off_history ?? []), historyEntry],
  }

  if (action === 'Approved' || action === 'Rejected') {
    patch.signed_off_by = user.id
    patch.signed_off_by_name = byName
    patch.signed_off_at = new Date().toISOString()
    patch.sign_off_notes = notes || null
  }

  let timesheet
  if (existing?.id) {
    const { data } = await admin.from('weekly_timesheets').update(patch).eq('id', existing.id).select('*, timesheet_days(*)').single()
    timesheet = data
  } else {
    const { data } = await admin.from('weekly_timesheets').insert({
      person_id: personId, week_starting: weekStarting, company_id: profile?.company_id, ...patch,
    }).select('*, timesheet_days(*)').single()
    timesheet = data
  }

  // ── Send approval email ───────────────────────────────────────────────────
  if (action === 'Approved') {
    try {
      const { data: person } = await admin.from('people')
        .select('name, email, standard_rate, ot_rate_1, ot_rate_2')
        .eq('id', personId).single()

      if (person?.email) {
        const weekEnd = new Date(weekStarting + 'T00:00:00')
        weekEnd.setDate(weekEnd.getDate() + 6)
        const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

        const days: any[] = timesheet?.timesheet_days ?? []
        const std = person.standard_rate ?? 0
        const ot1 = person.ot_rate_1 ?? std
        const ot2 = person.ot_rate_2 ?? std
        const regHrs  = days.reduce((s: number, d: any) => s + +d.hours_regular, 0)
        const ot1Hrs  = days.reduce((s: number, d: any) => s + +d.hours_ot1, 0)
        const ot2Hrs  = days.reduce((s: number, d: any) => s + +d.hours_ot2, 0)
        const totalPay = regHrs * std + ot1Hrs * ot1 + ot2Hrs * ot2
        const bonus = existing?.bonus ?? 0

        const bonusLine = bonus > 0
          ? `<p style="color:#7c3aed;font-weight:600">🎉 Weekly performance bonus: <strong>£${bonus.toFixed(2)}</strong> — well done!</p>`
          : `<p style="color:#64748b">No performance bonus was awarded this week.</p>`

        await resend.emails.send({
          from: 'Scotplant Contractors <scotplant.ai@gmail.com>',
          to: person.email,
          subject: `✅ Timesheet approved — week ending ${weekEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
              <div style="background:#1e3a6b;padding:24px;border-radius:8px 8px 0 0">
                <h1 style="color:#fff;margin:0;font-size:20px">Timesheet Approved ✅</h1>
              </div>
              <div style="background:#f8fafc;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none">
                <p>Hi <strong>${person.name}</strong>,</p>
                <p>Your timesheet for the week of <strong>${fmtDate(weekStarting)} – ${weekEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong> has been approved.</p>

                <div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin:16px 0">
                  <table style="width:100%;font-size:14px;border-collapse:collapse">
                    ${regHrs > 0 ? `<tr><td style="padding:4px 0;color:#64748b">Regular hours</td><td style="text-align:right;font-weight:600">${regHrs.toFixed(1)}h @ £${std.toFixed(2)}/hr</td></tr>` : ''}
                    ${ot1Hrs > 0 ? `<tr><td style="padding:4px 0;color:#64748b">OT1 hours</td><td style="text-align:right;font-weight:600">${ot1Hrs.toFixed(1)}h @ £${ot1.toFixed(2)}/hr</td></tr>` : ''}
                    ${ot2Hrs > 0 ? `<tr><td style="padding:4px 0;color:#64748b">OT2 hours</td><td style="text-align:right;font-weight:600">${ot2Hrs.toFixed(1)}h @ £${ot2.toFixed(2)}/hr</td></tr>` : ''}
                    ${bonus > 0 ? `<tr><td style="padding:4px 0;color:#7c3aed">Performance bonus</td><td style="text-align:right;font-weight:600;color:#7c3aed">£${bonus.toFixed(2)}</td></tr>` : ''}
                    <tr style="border-top:2px solid #e2e8f0">
                      <td style="padding:8px 0 0;font-weight:700">Total pay</td>
                      <td style="text-align:right;font-weight:700;font-size:16px;color:#22c55e">£${(totalPay + bonus).toFixed(2)}</td>
                    </tr>
                  </table>
                </div>

                ${bonusLine}
                ${notes ? `<p style="color:#64748b;font-style:italic">Note from manager: "${notes}"</p>` : ''}
                <p style="color:#94a3b8;font-size:12px;margin-top:24px">Approved by ${byName} · Scotplant Contractors</p>
              </div>
            </div>`,
        })
      }
    } catch (emailErr: any) {
      // Don't fail the whole request if email fails — log and continue
      console.error('Timesheet approval email failed:', emailErr.message)
    }
  }

  return NextResponse.json({ timesheet: { ...timesheet, days: timesheet?.timesheet_days ?? [] } })
}
