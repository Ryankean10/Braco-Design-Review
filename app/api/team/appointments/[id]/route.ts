import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, MANAGER_ROLES } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireRole(MANAGER_ROLES)
  if ('error' in auth) return auth.error
  const supabase = await createClient()

  const body = await req.json()
  const { role_on_job, is_manager, start_date, end_date, notes } = body

  const { data, error } = await supabase
    .from('job_appointments')
    .update({
      role_on_job: role_on_job ?? null,
      is_manager: is_manager ?? false,
      start_date: start_date || null,
      end_date: end_date || null,
      notes: notes ?? null,
    })
    .eq('id', id)
    .select(`*, person:people(id,name,role,discipline,company), project:projects(id,name,client), site:construction_sites(id,name,client)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
