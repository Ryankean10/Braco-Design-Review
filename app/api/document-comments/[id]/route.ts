import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: commentId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'engineer'].includes(profile?.role ?? ''))
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const { action } = await req.json() as { action: 'resolve' | 'reopen' }

  if (action === 'resolve') {
    await supabase.from('document_comments').update({
      status: 'resolved',
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    }).eq('id', commentId)
  } else if (action === 'reopen') {
    await supabase.from('document_comments').update({
      status: 'open',
      resolved_by: null,
      resolved_at: null,
    }).eq('id', commentId)
  } else {
    return NextResponse.json({ error: 'action must be resolve or reopen' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
