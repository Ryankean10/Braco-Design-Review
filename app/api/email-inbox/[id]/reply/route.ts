import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const admin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  const role = (profile as any)?.role ?? ''
  if (!['superadmin', 'admin', 'project_manager'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { replyText } = await req.json()
  if (!replyText?.trim()) return NextResponse.json({ error: 'Reply text required' }, { status: 400 })

  const { data: inbox } = await admin
    .from('email_inbox')
    .select('*')
    .eq('id', id)
    .single()

  if (!inbox) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const senderName = (profile as any)?.full_name ?? 'Scotplant AI'

  const { error: sendError } = await resend.emails.send({
    from: `${senderName} <scotplantai@yacht-gitana.com>`,
    to: inbox.from_email,
    subject: `Re: ${inbox.subject ?? 'Your enquiry'}`,
    text: replyText,
  })

  if (sendError) return NextResponse.json({ error: sendError.message }, { status: 500 })

  await admin.from('email_inbox').update({
    status: 'replied',
    reply_text: replyText,
    reply_sent_at: new Date().toISOString(),
    replied_by: user.id,
  }).eq('id', id)

  return NextResponse.json({ ok: true })
}
