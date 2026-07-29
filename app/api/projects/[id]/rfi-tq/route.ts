import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data, error } = await supabase
    .from('rfis_tqs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id, full_name, email')
    .eq('id', user.id)
    .single()

  const role = (profile as any)?.role ?? ''
  if (!['superadmin', 'admin', 'engineer', 'project_manager'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { data: item, error } = await supabase
    .from('rfis_tqs')
    .insert({
      ...body,
      project_id: projectId,
      company_id: (profile as any)?.company_id,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userName = (profile as any)?.full_name ?? (profile as any)?.email ?? 'Unknown'
  await supabase.from('rfi_tq_audit_log').insert({
    rfi_tq_id: item.id,
    user_id: user.id,
    user_name: userName,
    action: 'created',
    changes: [{ field: 'status', old_value: null, new_value: item.status }],
  })

  return NextResponse.json(item, { status: 201 })
}
