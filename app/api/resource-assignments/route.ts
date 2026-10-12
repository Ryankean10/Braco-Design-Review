import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const admin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, company_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { company_id, person_id, project_id, site_id, assign_date, role_on_day, notes } = body

  if (!person_id || !assign_date) return NextResponse.json({ error: 'person_id and assign_date are required' }, { status: 400 })
  if (!project_id && !site_id) return NextResponse.json({ error: 'project_id or site_id is required' }, { status: 400 })

  // Verify company scope
  const effectiveCompany = profile.role === 'superadmin' ? company_id : profile.company_id
  if (!effectiveCompany) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await admin.from('resource_assignments').insert({
    company_id: effectiveCompany,
    person_id,
    project_id: project_id ?? null,
    site_id: site_id ?? null,
    assign_date,
    role_on_day: role_on_day ?? null,
    notes: notes ?? null,
    created_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
