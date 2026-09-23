import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

async function auth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: profile } = await admin.from('profiles').select('role, company_id').eq('id', user.id).single()
  if (!profile) return null
  return { admin, profile, userId: user.id }
}

export async function GET() {
  const ctx = await auth()
  if (!ctx) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { admin, profile } = ctx
  const query = admin.from('estimates').select('*, estimate_items(id, section, total_cost, markup_pct)').order('created_at', { ascending: false })
  if (profile.role !== 'superadmin') query.eq('company_id', profile.company_id)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const ctx = await auth()
  if (!ctx) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { admin, profile, userId } = ctx
  const body = await req.json()

  // Generate reference number
  const companyId = profile.role === 'superadmin' ? body.company_id : profile.company_id
  const { count } = await admin.from('estimates').select('*', { count: 'exact', head: true }).eq('company_id', companyId)
  const ref = `EST-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, '0')}`

  const { data, error } = await admin.from('estimates').insert({
    ...body,
    company_id: companyId,
    reference: ref,
    created_by: userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
