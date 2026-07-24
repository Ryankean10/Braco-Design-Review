import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: profile } = await admin.from('profiles').select('role, full_name').eq('id', user.id).single()
  const role = profile?.role ?? ''
  if (!['admin', 'superadmin', 'project_manager'].includes(role)) {
    return NextResponse.json({ error: 'Only admin or PM can approve holidays' }, { status: 403 })
  }

  const { action, rejectionNote } = await req.json()
  if (!['Approved', 'Rejected', 'Revoked'].includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  if (action === 'Rejected' && !rejectionNote?.trim()) return NextResponse.json({ error: 'Rejection note required' }, { status: 400 })
  if (action === 'Revoked' && !['admin', 'superadmin'].includes(role)) {
    return NextResponse.json({ error: 'Only admin can remove an approval' }, { status: 403 })
  }

  const patch: Record<string, unknown> = action === 'Revoked'
    ? { status: 'Pending', approved_by: null, approved_by_name: null, approved_at: null, rejection_note: null }
    : {
        status: action,
        approved_by: user.id,
        approved_by_name: profile?.full_name ?? null,
        approved_at: new Date().toISOString(),
      }
  if (action === 'Rejected') patch.rejection_note = rejectionNote.trim()

  const { data: booking, error } = await admin.from('holiday_bookings').update(patch).eq('id', id).select('*, people(name, email, holiday_allowance)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Send approval/rejection email ─────────────────────────────────────────
  if (action === 'Approved' || action === 'Rejected') {
    try {
      const personRaw = booking.people
      const person = Array.isArray(personRaw) ? personRaw[0] : personRaw

      if (person?.email) {
        const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

        // Calculate remaining allowance
        const { data: usedRows } = await admin.from('holiday_bookings')
          .select('days_taken')
          .eq('person_id', booking.person_id)
          .eq('status', 'Approved')
        const usedDays = (usedRows ?? []).reduce((s: number, r: any) => s + r.days_taken, 0)
        const totalAllowance = person.holiday_allowance ?? 28
        const remaining = totalAllowance - usedDays

        if (action === 'Approved') {
          await resend.emails.send({
            from: 'Scotplant Contractors <onboarding@resend.dev>',
            to: person.email,
            subject: `✅ Holiday approved — ${fmtDate(booking.start_date)} to ${fmtDate(booking.end_date)}`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
                <div style="background:#1e3a6b;padding:24px;border-radius:8px 8px 0 0">
                  <h1 style="color:#fff;margin:0;font-size:20px">Holiday Approved ✅</h1>
                </div>
                <div style="background:#f8fafc;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none">
                  <p>Hi <strong>${person.name}</strong>,</p>
                  <p>Your holiday request has been <strong style="color:#22c55e">approved</strong>.</p>

                  <div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin:16px 0">
                    <table style="width:100%;font-size:14px;border-collapse:collapse">
                      <tr><td style="padding:4px 0;color:#64748b">From</td><td style="text-align:right;font-weight:600">${fmtDate(booking.start_date)}</td></tr>
                      <tr><td style="padding:4px 0;color:#64748b">To</td><td style="text-align:right;font-weight:600">${fmtDate(booking.end_date)}</td></tr>
                      <tr><td style="padding:4px 0;color:#64748b">Working days</td><td style="text-align:right;font-weight:600">${booking.days_taken} day${booking.days_taken !== 1 ? 's' : ''}</td></tr>
                      <tr style="border-top:2px solid #e2e8f0">
                        <td style="padding:8px 0 0;color:#64748b">Remaining allowance</td>
                        <td style="text-align:right;font-weight:700;color:${remaining <= 5 ? '#ef4444' : remaining <= 10 ? '#f59e0b' : '#22c55e'}">${remaining} days</td>
                      </tr>
                    </table>
                  </div>

                  ${booking.description ? `<p style="color:#64748b;font-style:italic">"${booking.description}"</p>` : ''}
                  <p style="color:#94a3b8;font-size:12px;margin-top:24px">Approved by ${profile?.full_name ?? 'Manager'} · Scotplant Contractors</p>
                </div>
              </div>`,
          })
        } else {
          await resend.emails.send({
            from: 'Scotplant Contractors <onboarding@resend.dev>',
            to: person.email,
            subject: `❌ Holiday request not approved — ${fmtDate(booking.start_date)} to ${fmtDate(booking.end_date)}`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
                <div style="background:#1e3a6b;padding:24px;border-radius:8px 8px 0 0">
                  <h1 style="color:#fff;margin:0;font-size:20px">Holiday Request — Not Approved</h1>
                </div>
                <div style="background:#f8fafc;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none">
                  <p>Hi <strong>${person.name}</strong>,</p>
                  <p>Unfortunately your holiday request for <strong>${fmtDate(booking.start_date)} – ${fmtDate(booking.end_date)}</strong> (${booking.days_taken} day${booking.days_taken !== 1 ? 's' : ''}) was not approved.</p>
                  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:16px;margin:16px 0">
                    <p style="margin:0;color:#dc2626"><strong>Reason:</strong> ${rejectionNote}</p>
                  </div>
                  <p>Please speak to your manager if you have any questions.</p>
                  <p style="color:#94a3b8;font-size:12px;margin-top:24px">Scotplant Contractors</p>
                </div>
              </div>`,
          })
        }
      }
    } catch (emailErr: any) {
      console.error('Holiday approval email failed:', emailErr.message)
    }
  }

  return NextResponse.json({ booking })
}
