import { NextRequest, NextResponse } from 'next/server'
import { requireRole, MANAGER_ROLES } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(MANAGER_ROLES)
  if ('error' in auth) return auth.error
  const { id } = await params
  await admin().from('haulage_tasks').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
