import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}

export async function GET() {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await supabase.from('plant_items').select('*').order('name')
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await supabase.from('plant_items').insert({
    company_id:       body.company_id,
    name:             body.name,
    category:         body.category ?? 'other',
    make:             body.make || null,
    model:            body.model || null,
    plant_ref:        body.plant_ref || null,
    year:             body.year ? parseInt(body.year) : null,
    status:           body.status ?? 'available',
    supplier:         body.supplier || null,
    hire_rate_daily:  body.hire_rate_daily ? parseFloat(body.hire_rate_daily) : null,
    hire_rate_weekly: body.hire_rate_weekly ? parseFloat(body.hire_rate_weekly) : null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
