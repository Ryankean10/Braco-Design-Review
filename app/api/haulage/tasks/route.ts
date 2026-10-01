import { NextRequest, NextResponse } from 'next/server'
import { requireRole, MANAGER_ROLES } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const auth = await requireRole(MANAGER_ROLES)
  if ('error' in auth) return auth.error
  const body = await req.json()
  const { data, error } = await admin().from('haulage_tasks').insert({ ...body, created_by: auth.user.id }).select('*, people(name), haulage_vehicles(name,reg), projects(name)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
