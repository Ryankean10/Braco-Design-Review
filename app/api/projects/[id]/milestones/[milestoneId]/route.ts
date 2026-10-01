import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const admin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

async function getAuth(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role, company_id').eq('id', user.id).single()
  const { data: project } = await admin.from('projects').select('company_id').eq('id', projectId).single()
  if (!project || (profile?.company_id !== project.company_id && profile?.role !== 'superadmin')) return null
  return { user, profile }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const { id, milestoneId } = await params
  const auth = await getAuth(id)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowedFields = ['label', 'amount', 'currency', 'agreed_date', 'due_date', 'status', 'invoice_ref', 'notes']
  const update: Record<string, any> = {}
  for (const f of allowedFields) {
    if (f in body) update[f] = body[f]
  }

  const { data, error } = await admin
    .from('payment_milestones')
    .update(update)
    .eq('id', milestoneId)
    .eq('project_id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const { id, milestoneId } = await params
  const auth = await getAuth(id)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await admin
    .from('payment_milestones')
    .delete()
    .eq('id', milestoneId)
    .eq('project_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
