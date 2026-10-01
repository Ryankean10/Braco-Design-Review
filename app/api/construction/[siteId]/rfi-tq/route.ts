import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, INTERNAL_ROLES } from '@/lib/auth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  const auth = await requireRole(INTERNAL_ROLES)
  if ('error' in auth) return auth.error

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('rfis_tqs')
    .select('*')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  const auth = await requireRole(INTERNAL_ROLES)
  if ('error' in auth) return auth.error

  const supabase = await createClient()

  const { data: site } = await supabase
    .from('construction_sites')
    .select('id, project_id')
    .eq('id', siteId)
    .single()
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, full_name, email')
    .eq('id', auth.user.id)
    .single()

  const body = await req.json()
  const { data: item, error } = await supabase
    .from('rfis_tqs')
    .insert({
      ...body,
      site_id: siteId,
      project_id: site.project_id ?? null,
      company_id: (profile as any)?.company_id,
      created_by: auth.user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userName = (profile as any)?.full_name ?? (profile as any)?.email ?? 'Unknown'
  await supabase.from('rfi_tq_audit_log').insert({
    rfi_tq_id: item.id,
    user_id: auth.user.id,
    user_name: userName,
    action: 'created',
    changes: [{ field: 'status', old_value: null, new_value: item.status }],
  })

  return NextResponse.json(item, { status: 201 })
}
