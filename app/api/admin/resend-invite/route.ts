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

  // generateLink produces a fresh invite token without creating a new user
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
  })
  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 })

  const inviteUrl = linkData?.properties?.action_link
  if (!inviteUrl) return NextResponse.json({ error: 'Could not generate invite link' }, { status: 500 })

  // Send the email ourselves via Resend
  const { resend, fromEmail } = getResendClient(companySlug)
  const { error: sendErr } = await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: "You've been invited",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="margin-bottom:8px">You've been invited</h2>
        <p style="color:#666;margin-bottom:24px">You've been invited to join the platform. Click the link below to set your password and get started.</p>
        <a href="${inviteUrl}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Accept invitation</a>
        <p style="color:#999;font-size:12px;margin-top:24px">This link expires in 24 hours. If you weren't expecting this, you can ignore it.</p>
      </div>
    `,
    text: `You've been invited. Accept here: ${inviteUrl}`,
  })

  if (sendErr) return NextResponse.json({ error: `Link generated but email failed: ${JSON.stringify(sendErr)}` }, { status: 500 })

  return NextResponse.json({ ok: true })
}
