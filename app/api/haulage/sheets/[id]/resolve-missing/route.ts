import { NextRequest, NextResponse } from 'next/server'
import { requireRole, MANAGER_ROLES } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(MANAGER_ROLES)
  if ('error' in auth) return auth.error

  const { id } = await params
  const { task_id } = await req.json()
  if (!task_id) return NextResponse.json({ error: 'task_id required' }, { status: 400 })

  const db = admin()

  const { data: sheet } = await db
    .from('haulage_daily_sheets')
    .select('missing_tasks')
    .eq('id', id)
    .single()

  if (!sheet) return NextResponse.json({ error: 'Sheet not found' }, { status: 404 })

  const updated = (sheet.missing_tasks ?? []).filter((t: any) => t.task_id !== task_id)

  const { error } = await db
    .from('haulage_daily_sheets')
    .update({ missing_tasks: updated.length ? updated : null })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
