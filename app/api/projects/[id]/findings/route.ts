import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'project_manager', 'engineer'].includes(profile?.role ?? ''))
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const body = await req.json() as { id: string; status: 'Approved' | 'Rejected'; review_notes?: string }
  const { id: findingId, status, review_notes } = body

  if (!findingId || !['Approved', 'Rejected'].includes(status))
    return NextResponse.json({ error: 'id and status (Approved|Rejected) required' }, { status: 400 })

  const { error } = await supabase
    .from('design_findings')
    .update({
      status,
      review_notes: review_notes ?? null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', findingId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
