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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { error } = await supabase.from('plant_items').update({
    name:             body.name,
    category:         body.category,
    make:             body.make || null,
    model:            body.model || null,
    plant_ref:        body.plant_ref || null,
    year:             body.year ? parseInt(body.year) : null,
    status:           body.status,
    project_id:       body.project_id || null,
    operator_id:      body.operator_id || null,
    supplier:         body.supplier || null,
    hire_rate_daily:  body.hire_rate_daily ? parseFloat(body.hire_rate_daily) : null,
    hire_rate_weekly: body.hire_rate_weekly ? parseFloat(body.hire_rate_weekly) : null,
    on_hire_date:     body.on_hire_date || null,
    expected_off_hire: body.expected_off_hire || null,
    notes:            body.notes || null,
  }).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await supabase.from('plant_items').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
