import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: profile } = await admin.from('profiles').select('role, company_id').eq('id', user.id).single()
  if (!['admin', 'superadmin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '50')

  let query = admin
    .from('email_inbox')
    .select('*, people(name)')
    .order('received_at', { ascending: false })
    .limit(limit)

  if (profile?.role !== 'superadmin') {
    // Also show emails with null company_id (unknown senders) so admins can see and re-process them
    query = query.or(`company_id.eq.${profile?.company_id},company_id.is.null`)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
