import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

async function getCtx() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role, company_id').eq('id', user.id).single()
  if (!profile) return null
  return { user, profile, supabase }
}

function adminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function GET(req: NextRequest) {
  const ctx = await getCtx()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const companyId = (ctx.profile as any).company_id

  let query = (ctx.supabase as any)
    .from('planner_assignments')
    .select('*')
    .eq('company_id', companyId)
    .order('date')

  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (ctx.profile as any).role
  if (!['admin', 'superadmin', 'project_manager'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { person_id, person_label, date, type, client, scope, location, notes, project_id } = body

  if (!date || !type || !person_label) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const companyId = (ctx.profile as any).company_id
  const admin = adminClient()

  const row = {
    company_id: companyId,
    person_id: person_id ?? null,
    person_label,
    date,
    type,
    client: client || null,
    scope: scope || null,
    location: location || null,
    notes: notes || null,
    project_id: project_id || null,
    updated_at: new Date().toISOString(),
  }

  // Upsert on person_id+date when person_id present, otherwise insert/update by id
  const existingId = body.id
  let result

  if (existingId) {
    result = await (admin as any).from('planner_assignments').update(row).eq('id', existingId).select().single()
  } else if (person_id) {
    result = await (admin as any).from('planner_assignments')
      .upsert({ ...row }, { onConflict: 'person_id,date' })
      .select().single()
  } else {
    result = await (admin as any).from('planner_assignments').insert(row).select().single()
  }

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 })
  return NextResponse.json(result.data)
}
