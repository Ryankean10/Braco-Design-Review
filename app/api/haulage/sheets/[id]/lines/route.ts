import { NextRequest, NextResponse } from 'next/server'
import { requireRole, MANAGER_ROLES } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(MANAGER_ROLES)
  if ('error' in auth) return auth.error

  const { id } = await params
  const body = await req.json()
  const { description, start_time, end_time, project_id, task_id, is_adhoc } = body

  if (!description) return NextResponse.json({ error: 'description required' }, { status: 400 })

  const db = admin()

  const { data: sheet } = await db
    .from('haulage_daily_sheets')
    .select('company_id')
    .eq('id', id)
    .single()

  if (!sheet) return NextResponse.json({ error: 'Sheet not found' }, { status: 404 })

  let hours: number | null = null
  if (start_time && end_time) {
    const [sh, sm] = start_time.split(':').map(Number)
    const [eh, em] = end_time.split(':').map(Number)
    hours = Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 100) / 100
  }

  const { data: line, error } = await db
    .from('haulage_sheet_lines')
    .insert({
      sheet_id: id,
      company_id: sheet.company_id,
      description,
      start_time: start_time || null,
      end_time: end_time || null,
      hours,
      project_id: project_id || null,
      task_id: task_id || null,
      is_adhoc: is_adhoc ?? false,
      is_flagged: false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update sheet status if it was approved (re-open for review)
  await db
    .from('haulage_daily_sheets')
    .update({ status: 'received' })
    .eq('id', id)
    .eq('status', 'approved')

  return NextResponse.json(line)
}
