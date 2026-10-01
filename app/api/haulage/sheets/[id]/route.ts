import { NextRequest, NextResponse } from 'next/server'
import { requireRole, MANAGER_ROLES } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(MANAGER_ROLES)
  if ('error' in auth) return auth.error
  const { id } = await params
  const body = await req.json()
  const updates: any = { ...body }
  if (body.status === 'approved') { updates.approved_by = auth.user.id; updates.approved_at = new Date().toISOString() }
  const { data, error } = await admin().from('haulage_daily_sheets').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
