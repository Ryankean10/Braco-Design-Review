import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data: plant } = await supabase.from('plant_items').select('company_id').eq('id', id).single()
  if (!plant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabase.from('plant_certificates').insert({
    plant_id:    id,
    company_id:  body.company_id ?? plant.company_id,
    type:        body.type,
    reference:   body.reference || null,
    issued_date: body.issued_date || null,
    expiry_date: body.expiry_date,
    issued_by:   body.issued_by || null,
    notes:       body.notes || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
