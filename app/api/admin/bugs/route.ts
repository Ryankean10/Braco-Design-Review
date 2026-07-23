import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

async function getAdminClient() {
  const cookieStore = await cookies()
  // SSR client used only for auth.getUser() — it validates the session cookie
  const ssrClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await ssrClient.auth.getUser()
  if (!user) return { error: 'Unauthorized', admin: null, user: null }

  // Service role bypasses RLS — superadmin may be on a different subdomain
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = (profile as any)?.role
  if (!['admin', 'superadmin'].includes(role)) return { error: 'Forbidden', admin: null, user: null }
  return { error: null, admin, user }
}

export async function GET(req: NextRequest) {
  const { error, admin } = await getAdminClient()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'open'

  const { data, error: dbError } = await admin!
    .from('bug_reports')
    .select('*')
    .eq('status', status)
    .order('reported_at', { ascending: false })

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ bugs: data ?? [] })
}
