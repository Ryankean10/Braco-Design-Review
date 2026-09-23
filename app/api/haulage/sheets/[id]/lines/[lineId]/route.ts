import { NextRequest, NextResponse } from 'next/server'
import { requireRole, MANAGER_ROLES } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; lineId: string }> }) {
  const auth = await requireRole(MANAGER_ROLES)
  if ('error' in auth) return auth.error
  const { id, lineId } = await params
  const body = await req.json()

  // Recalculate hours if times changed
  let hours = body.hours
  if (body.start_time && body.end_time && !hours) {
    const [sh, sm] = body.start_time.split(':').map(Number)
    const [eh, em] = body.end_time.split(':').map(Number)
    hours = parseFloat(((eh * 60 + em - sh * 60 - sm) / 60).toFixed(2))
  }

  const { data, error } = await admin().from('haulage_sheet_lines').update({ ...body, hours }).eq('id', lineId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If all lines on the sheet are now resolved, update sheet status
  const { data: remaining } = await admin().from('haulage_sheet_lines').select('id').eq('sheet_id', id).eq('is_flagged', true)
  if ((remaining ?? []).length === 0) {
    await admin().from('haulage_daily_sheets').update({ status: 'received' }).eq('id', id).eq('status', 'flagged')
  }

  return NextResponse.json(data)
}
