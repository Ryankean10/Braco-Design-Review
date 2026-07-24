import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: profile } = await admin.from('profiles').select('role, full_name').eq('id', user.id).single()
  const role = profile?.role ?? ''
  if (!['admin', 'superadmin', 'project_manager'].includes(role)) {
    return NextResponse.json({ error: 'Only admin or PM can approve holidays' }, { status: 403 })
  }

  const { action, rejectionNote } = await req.json()
  if (!['Approved', 'Rejected'].includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  if (action === 'Rejected' && !rejectionNote?.trim()) return NextResponse.json({ error: 'Rejection note required' }, { status: 400 })

  const patch: Record<string, unknown> = {
    status: action,
    approved_by: user.id,
    approved_by_name: profile?.full_name ?? null,
    approved_at: new Date().toISOString(),
  }
  if (action === 'Rejected') patch.rejection_note = rejectionNote.trim()

  const { data: booking, error } = await admin.from('holiday_bookings').update(patch).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ booking })
}
