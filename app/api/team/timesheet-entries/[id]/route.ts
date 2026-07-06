import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const { action, discrepancy_note } = body

  const { data: profile } = await supabase
    .from('profiles').select('full_name').eq('id', user.id).single()
  const userName = (profile as any)?.full_name ?? user.email ?? 'Unknown'

  let update: Record<string, unknown>

  if (action === 'flag') {
    update = {
      discrepancy_flag: true,
      discrepancy_note: discrepancy_note ?? null,
    }
  } else if (action === 'unflag') {
    update = {
      discrepancy_flag: false,
      discrepancy_note: null,
    }
  } else if (action === 'signoff') {
    update = {
      signed_off_by: user.id,
      signed_off_at: new Date().toISOString(),
      signed_off_name: userName,
      discrepancy_flag: false,
    }
  } else if (action === 'unsignoff') {
    update = {
      signed_off_by: null,
      signed_off_at: null,
      signed_off_name: null,
    }
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('timesheet_entries')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
