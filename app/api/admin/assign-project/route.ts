import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'project_manager'].includes(profile?.role ?? ''))
    return NextResponse.json({ error: 'Admin/PM only' }, { status: 403 })

  const { userId, projectId, targetRole, remove } = await req.json()

  if (remove) {
    // Use correct table based on role
    if (targetRole === 'client') {
      await supabase.from('project_clients').delete().eq('project_id', projectId).eq('user_id', userId)
    } else {
      await supabase.from('project_members').delete().eq('project_id', projectId).eq('user_id', userId)
    }
    return NextResponse.json({ ok: true })
  }

  const table = targetRole === 'client' ? 'project_clients' : 'project_members'
  const { error } = await supabase.from(table).insert({ project_id: projectId, user_id: userId, added_by: user.id })
  if (error && !error.message.includes('duplicate')) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
