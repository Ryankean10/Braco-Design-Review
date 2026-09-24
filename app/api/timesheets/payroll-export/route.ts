import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const week = req.nextUrl.searchParams.get('week')
  if (!week) return NextResponse.json({ error: 'week param required' }, { status: 400 })

  const weekEnd = new Date(week); weekEnd.setDate(weekEnd.getDate() + 6)
  const weekEndStr = weekEnd.toISOString().slice(0, 10)

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: profile } = await admin.from('profiles').select('company_id').eq('id', user.id).single()

  const [{ data: timesheets }, { data: holBookings }] = await Promise.all([
    admin
      .from('weekly_timesheets')
      .select('*, people(name, role, standard_rate, ot_rate_1, ot_rate_2), timesheet_days(*)')
      .eq('company_id', profile?.company_id)
      .eq('week_starting', week)
      .eq('status', 'Approved')
      .order('created_at'),
    admin
      .from('holiday_bookings')
      .select('person_id, days_taken, start_date, end_date')
      .eq('status', 'Approved')
      .lte('start_date', weekEndStr)
      .gte('end_date', week),
  ])

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  // Build week date array (Mon–Sun)
  const weekDates: string[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(week); d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })

  function isApprovedHoliday(personId: string, date: string): boolean {
    const dow = new Date(date + 'T00:00:00').getDay()
    if (dow === 0 || dow === 6) return false
    return (holBookings ?? []).some(b =>
      b.person_id === personId && b.start_date <= date && date <= b.end_date
    )
  }

  const rows = (timesheets ?? []).map((ts: any) => {
    const person = ts.people
    const days: any[] = ts.timesheet_days ?? []
    const stdRate = +person.standard_rate || 0
    const ot1Rate = +person.ot_rate_1 || stdRate
    const ot2Rate = +person.ot_rate_2 || stdRate
    const bonus   = +(ts.bonus ?? 0)

    // Holiday days come from approved holiday_bookings (same logic as UI)
    const holDays = weekDates.filter(d => isApprovedHoliday(ts.person_id, d)).length

    // Working day hours from timesheet_days (excluding any marked is_holiday for legacy compat)
    const regHrs = days.reduce((s: number, d: any) => s + (d.is_holiday ? 0 : +d.hours_regular), 0)
    const ot1Hrs = days.reduce((s: number, d: any) => s + (d.is_holiday ? 0 : +d.hours_ot1), 0)
    const ot2Hrs = days.reduce((s: number, d: any) => s + (d.is_holiday ? 0 : +d.hours_ot2), 0)

    const pay = holDays * 10 * stdRate
              + regHrs * stdRate
              + ot1Hrs * ot1Rate
              + ot2Hrs * ot2Rate
              + bonus

    return { name: person.name, role: person.role, regHrs, ot1Hrs, ot2Hrs, holDays, stdRate, ot1Rate, ot2Rate, bonus, pay, signedBy: ts.signed_off_by_name, signedAt: ts.signed_off_at }
  })

  const totalPay = rows.reduce((s: number, r: any) => s + r.pay, 0)

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Payroll Export — Week ${fmtDate(week)}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 20px; }
  h1 { font-size: 16px; margin-bottom: 4px; }
  p.sub { color: #555; margin-bottom: 20px; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1e3a6b; color: #fff; padding: 6px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 6px 10px; border-bottom: 1px solid #e5e7eb; }
  tr:last-child td { border-bottom: none; }
  .num { text-align: right; }
  .bonus-cell { color: #7c3aed; font-weight: 600; }
  .total-row td { font-weight: 700; border-top: 2px solid #1e3a6b; background: #f8fafc; }
  .footer { margin-top: 24px; font-size: 10px; color: #888; }
  @media print {
    body { margin: 10mm; }
    button { display: none; }
  }
</style>
</head>
<body>
<button onclick="window.print()" style="margin-bottom:16px;padding:8px 16px;background:#1e3a6b;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;">Print / Save as PDF</button>
<h1>Payroll Export</h1>
<p class="sub">Week ending ${fmtDate(weekEndStr)} &nbsp;·&nbsp; ${rows.length} approved timesheet${rows.length !== 1 ? 's' : ''} &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
<table>
  <thead>
    <tr>
      <th>Name</th><th>Role</th>
      <th class="num">Reg hrs</th><th class="num">OT1 hrs</th><th class="num">OT2 hrs</th>
      <th class="num">Hol days</th><th class="num">Std rate</th><th class="num">OT1 rate</th><th class="num">OT2 rate</th>
      <th class="num">Bonus</th><th class="num">Total pay</th><th>Approved by</th>
    </tr>
  </thead>
  <tbody>
    ${rows.map((r: any) => `
    <tr>
      <td>${r.name}</td>
      <td style="color:#555">${r.role ?? '—'}</td>
      <td class="num">${r.regHrs.toFixed(1)}</td>
      <td class="num">${r.ot1Hrs > 0 ? r.ot1Hrs.toFixed(1) : '—'}</td>
      <td class="num">${r.ot2Hrs > 0 ? r.ot2Hrs.toFixed(1) : '—'}</td>
      <td class="num">${r.holDays > 0 ? r.holDays : '—'}</td>
      <td class="num">£${r.stdRate.toFixed(2)}</td>
      <td class="num">${r.ot1Rate !== r.stdRate ? `£${r.ot1Rate.toFixed(2)}` : '—'}</td>
      <td class="num">${r.ot2Rate !== r.stdRate ? `£${r.ot2Rate.toFixed(2)}` : '—'}</td>
      <td class="num bonus-cell">${r.bonus > 0 ? `£${r.bonus.toFixed(2)}` : '—'}</td>
      <td class="num" style="font-weight:600">£${r.pay.toFixed(2)}</td>
      <td style="color:#555;font-size:10px">${r.signedBy ?? '—'}${r.signedAt ? `<br>${new Date(r.signedAt).toLocaleDateString('en-GB')}` : ''}</td>
    </tr>`).join('')}
    <tr class="total-row">
      <td colspan="10">TOTAL</td>
      <td class="num">£${totalPay.toFixed(2)}</td>
      <td></td>
    </tr>
  </tbody>
</table>
<p class="footer">This document is auto-generated from approved timesheets. All figures subject to payroll verification.</p>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="payroll-${week}.html"`,
    },
  })
}
