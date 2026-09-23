import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'superadmin'].includes(callerProfile?.role ?? '')) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  // Prevent self-deletion
  if (userId === user.id) return NextResponse.json({ error: 'You cannot remove yourself' }, { status: 400 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Delete from auth (cascades to profile via DB trigger if set, otherwise clean up manually)
  const { error: authErr } = await admin.auth.admin.deleteUser(userId)
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })

  // Delete profile explicitly in case there's no cascade
  await admin.from('profiles').delete().eq('id', userId)

  return NextResponse.json({ ok: true })
}
