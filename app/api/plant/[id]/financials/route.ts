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

  // Get plant company_id
  const { data: plant } = await supabase.from('plant_items').select('company_id').eq('id', id).single()
  if (!plant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabase.from('plant_financials').insert({
    plant_id:    id,
    company_id:  plant.company_id,
    project_id:  body.project_id || null,
    type:        body.type ?? 'cost',
    description: body.description || null,
    amount:      parseFloat(body.amount),
    date:        body.date,
    invoice_ref: body.invoice_ref || null,
    status:      body.status ?? 'outstanding',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
