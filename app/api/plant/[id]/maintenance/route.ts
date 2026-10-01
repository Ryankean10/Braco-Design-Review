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

  if (body.type === 'task') {
    const { data, error } = await supabase.from('plant_maintenance_tasks').insert({
      plant_id:       id,
      company_id:     body.company_id,
      title:          body.title,
      description:    body.description || null,
      interval_type:  body.interval_type || null,
      interval_value: body.interval_value ? parseInt(body.interval_value) : null,
      next_due_date:  body.next_due_date || null,
      recurring:      body.recurring ?? true,
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  }

  if (body.type === 'log') {
    const { data, error } = await supabase.from('plant_maintenance_log').insert({
      plant_id:        id,
      company_id:      body.company_id,
      task_id:         body.task_id || null,
      carried_out_by:  body.carried_out_by || null,
      carried_out_date: body.carried_out_date,
      description:     body.description,
      parts_used:      body.parts_used ?? [],
      labour_cost:     body.labour_cost ? parseFloat(body.labour_cost) : 0,
      parts_cost:      body.parts_used ? (body.parts_used as any[]).reduce((s: number, p: any) => s + (Number(p.cost) * Number(p.qty || 1)), 0) : 0,
      downtime_hours:  body.downtime_hours ? parseFloat(body.downtime_hours) : 0,
      next_due_date:   body.next_due_date || null,
      notes:           body.notes || null,
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Update task next_due_date if linked
    if (body.task_id && body.next_due_date) {
      await supabase.from('plant_maintenance_tasks').update({ next_due_date: body.next_due_date }).eq('id', body.task_id)
    }
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'type must be task or log' }, { status: 400 })
}
