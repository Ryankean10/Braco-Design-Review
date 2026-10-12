import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()

  // SSR client used only for auth.getUser() — validates the session cookie
  const ssrClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await ssrClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Service role bypasses RLS — superadmin may be on a different subdomain
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const { data: profile } = await admin.from('profiles').select('role, full_name').eq('id', user.id).maybeSingle()
  if (!['admin', 'superadmin'].includes((profile as any)?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { notes } = body

  const { error } = await admin.from('bug_reports').update({
    status: 'resolved',
    resolved_at: new Date().toISOString(),
    resolved_by: user.id,
    resolved_by_name: (profile as any)?.full_name ?? user.email,
    ...(notes ? { notes } : {}),
  }).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
