import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getResendClient } from '@/lib/resend'
import { headers } from 'next/headers'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
  if (!['superadmin', 'admin', 'project_manager'].includes((profile as any)?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { to, subject, body } = await req.json()
  if (!to?.trim() || !subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: 'to, subject and body are required' }, { status: 400 })
  }

  const headersList = await headers()
  const companySlug = headersList.get('x-company-slug') ?? null
  const { resend, fromEmail } = getResendClient(companySlug)

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: to.trim(),
    subject: subject.trim(),
    text: body.trim(),
  })

  if (error) return NextResponse.json({ error: (error as any).message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
