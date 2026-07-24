import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: profile } = await admin.from('profiles').select('role, company_id').eq('id', user.id).single()
  if (!['admin', 'superadmin', 'project_manager'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Only admin or PM can add people' }, { status: 403 })
  }

  const payload = await req.json()

  const { data: person, error } = await admin
    .from('people')
    .insert({ ...payload, company_id: profile?.company_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Send welcome email ────────────────────────────────────────────────────
  if (person.email) {
    try {
      const firstName = person.name.split(' ')[0]
      const roleLabel = person.role ?? 'team member'

      await resend.emails.send({
        from: 'Scotplant Contractors <scotplantai@yacht-gitana.com>',
        to: person.email,
        subject: 'Welcome to Scotplant Contractors',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
            <div style="background:#1e3a6b;padding:24px;border-radius:8px 8px 0 0">
              <h1 style="color:#fff;margin:0;font-size:20px">Welcome to Scotplant Contractors</h1>
            </div>
            <div style="background:#f8fafc;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none">
              <p>Hi <strong>${firstName}</strong>,</p>

              <p>Welcome to the Scot Plant Contractors Team. You have been added to the team in the role of <strong>${roleLabel}</strong>.</p>

              <p>We use an automated system for recording timesheets and holidays as well as a number of other functions in the business. When you are submitting timesheets and holiday requests please make sure they come from this email address to ensure they are picked up. If you change email just be sure to let us know.</p>

              <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0">
                <p style="margin:0 0 12px;font-weight:600;color:#1e3a6b">How to submit:</p>
                <p style="margin:0 0 8px">It's as simple as sending an email to <strong><a href="mailto:scotplant.ai@gmail.com" style="color:#1e3a6b">scotplant.ai@gmail.com</a></strong> with the subject <strong>'Timesheet'</strong> or <strong>'Holiday Request'</strong> and the times and days you worked or the dates you want the holiday for — the system will pick it up automatically.</p>
                <p style="margin:12px 0 0;color:#64748b;font-size:13px">You will receive an automatic email when a timesheet or holiday has been checked.</p>
              </div>

              <p>Any questions please get in touch.</p>

              <p style="margin-top:24px;color:#64748b">SPC Admin Team</p>
            </div>
          </div>`,
      })
    } catch (emailErr: any) {
      console.error('Welcome email failed:', emailErr.message)
    }
  }

  return NextResponse.json({ person })
}
