import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { getResendClient } from '@/lib/resend'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, company_id').eq('id', user.id).single()
  if (!['admin', 'superadmin'].includes(profile?.role ?? '')) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const headersList = await headers()
  const companySlug = headersList.get('x-company-slug') ?? null

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Try invite link first (unconfirmed users), fall back to recovery link (confirmed users)
  let inviteUrl: string | undefined
  let subject = "You've been invited"
  let bodyIntro = "You've been invited to join the platform. Click the link below to set your password and get started."
  let ctaText = 'Accept invitation'

  const { data: inviteData, error: inviteErr } = await admin.auth.admin.generateLink({ type: 'invite', email })

  if (!inviteErr) {
    inviteUrl = inviteData?.properties?.action_link
  } else {
    // User already confirmed — send a password reset so they can log in
    const { data: recoveryData, error: recoveryErr } = await admin.auth.admin.generateLink({ type: 'recovery', email })
    if (recoveryErr) return NextResponse.json({ error: recoveryErr.message }, { status: 500 })
    inviteUrl = recoveryData?.properties?.action_link
    subject = 'Your login link'
    bodyIntro = 'Your account is ready. Click the link below to set a new password and log in.'
    ctaText = 'Set password & log in'
  }

  if (!inviteUrl) return NextResponse.json({ error: 'Could not generate link' }, { status: 500 })

  const { resend, fromEmail } = getResendClient(companySlug)
  const { error: sendErr } = await resend.emails.send({
    from: fromEmail,
    to: email,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="margin-bottom:8px">${subject}</h2>
        <p style="color:#666;margin-bottom:24px">${bodyIntro}</p>
        <a href="${inviteUrl}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">${ctaText}</a>
        <p style="color:#999;font-size:12px;margin-top:24px">This link expires in 24 hours. If you weren't expecting this, you can ignore it.</p>
      </div>
    `,
    text: `${bodyIntro}\n\n${inviteUrl}`,
  })

  if (sendErr) return NextResponse.json({ error: `Email failed: ${JSON.stringify(sendErr)}` }, { status: 500 })

  return NextResponse.json({ ok: true })
}
