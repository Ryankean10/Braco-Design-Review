import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: callerProfile } = await supabase.from('profiles').select('role, company_id').eq('id', user.id).single()
  if (!['admin', 'superadmin'].includes(callerProfile?.role ?? '')) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const companyId: string = callerProfile?.company_id ?? ''
  const { email, role, full_name } = await req.json()
  if (!email || !role) return NextResponse.json({ error: 'Email and role required' }, { status: 400 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${req.headers.get('host')}`
  const redirectTo = `${siteUrl}/update-password`

  // Try to invite — if the user already exists (pending invite), look them up and resend
  let userId: string
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: full_name ?? null },
    redirectTo,
  })

  if (inviteErr) {
    // User already exists in auth — find them and resend the invite
    if (inviteErr.message.includes('already been registered') || inviteErr.message.includes('already registered')) {
      const { data: { users: existing } } = await admin.auth.admin.listUsers()
      const found = existing.find(u => u.email === email)
      if (!found) return NextResponse.json({ error: inviteErr.message }, { status: 500 })
      userId = found.id
      // Resend invite
      await admin.auth.admin.inviteUserByEmail(email)
    } else {
      return NextResponse.json({ error: inviteErr.message }, { status: 500 })
    }
  } else {
    userId = invited.user.id
  }

  // Upsert profile with role, name, and company_id so the user appears in the list
  const { error: profileErr } = await admin.from('profiles').upsert({
    id: userId,
    email,
    full_name: full_name ?? null,
    role,
    company_id: companyId,
  }, { onConflict: 'id' })
  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, userId })
}
