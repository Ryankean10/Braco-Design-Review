import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function getAdminClient() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', supabase, user: null }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = (profile as any)?.role
  if (!['admin', 'superadmin'].includes(role)) return { error: 'Forbidden', supabase, user: null }
  return { error: null, supabase, user }
}

export async function GET(req: NextRequest) {
  const { error, supabase } = await getAdminClient()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'open'

  const { data, error: dbError } = await supabase
    .from('bug_reports')
    .select('*')
    .eq('status', status)
    .order('reported_at', { ascending: false })

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ bugs: data ?? [] })
}
