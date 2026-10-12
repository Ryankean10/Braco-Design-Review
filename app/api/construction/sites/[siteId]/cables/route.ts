import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, INTERNAL_ROLES } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  const auth = await requireRole(INTERNAL_ROLES)
  if ('error' in auth) return auth.error
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cable_items')
    .select('*, cable_activities(*)')
    .eq('site_id', siteId)
    .order('package_name')
    .order('mvs')
    .order('cable_ref')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  const auth2 = await requireRole(INTERNAL_ROLES)
  if ('error' in auth2) return auth2.error
  const supabase = await createClient()

  const body = await req.json()
  const { data, error } = await supabase
    .from('cable_items')
    .insert({ ...body, site_id: siteId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
