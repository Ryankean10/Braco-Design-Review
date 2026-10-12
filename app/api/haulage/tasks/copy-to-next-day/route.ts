import { NextRequest, NextResponse } from 'next/server'
import { requireRole, MANAGER_ROLES } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

export async function POST(req: NextRequest) {
  const auth = await requireRole(MANAGER_ROLES)
  if ('error' in auth) return auth.error

  const { task_id, sheet_date } = await req.json()
  if (!task_id || !sheet_date) return NextResponse.json({ error: 'task_id and sheet_date required' }, { status: 400 })

  const db = admin()

  const { data: task } = await db
    .from('haulage_tasks')
    .select('title, description, location, driver_id, vehicle_id, project_id, company_id')
    .eq('id', task_id)
    .single()

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const d = new Date(sheet_date + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  const nextDate = d.toISOString().slice(0, 10)

  // Shift all existing tasks for that driver/date to make room at sort_order 0
  const { data: existing } = await db
    .from('haulage_tasks')
    .select('id, sort_order')
    .eq('task_date', nextDate)
    .eq('driver_id', task.driver_id)
    .order('sort_order')

  for (const t of existing ?? []) {
    await db.from('haulage_tasks').update({ sort_order: t.sort_order + 1 }).eq('id', t.id)
  }

  const { data: newTask, error } = await db
    .from('haulage_tasks')
    .insert({
      title: task.title,
      description: task.description,
      location: task.location,
      driver_id: task.driver_id,
      vehicle_id: task.vehicle_id,
      project_id: task.project_id,
      company_id: task.company_id,
      task_date: nextDate,
      est_start: '07:00:00',
      est_end: null,
      sort_order: 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ task: newTask, next_date: nextDate })
}
