import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const admin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const { assignmentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, company_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify the assignment belongs to the user's company before deleting
  const { data: existing } = await admin.from('resource_assignments').select('company_id').eq('id', assignmentId).single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (profile.role !== 'superadmin' && existing.company_id !== profile.company_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await admin.from('resource_assignments').delete().eq('id', assignmentId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
