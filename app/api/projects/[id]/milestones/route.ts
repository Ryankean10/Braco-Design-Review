import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const admin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

async function getAuth(req: NextRequest, projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role, company_id').eq('id', user.id).single()
  const { data: project } = await admin.from('projects').select('company_id').eq('id', projectId).single()
  if (!project || profile?.company_id !== project.company_id) {
    if (profile?.role !== 'superadmin') return null
  }
  return { user, profile, companyId: project?.company_id ?? profile?.company_id }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuth(req, id)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await admin
    .from('payment_milestones')
    .select('*')
    .eq('project_id', id)
    .order('due_date', { ascending: true, nullsFirst: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuth(req, id)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { label, amount, currency, agreed_date, due_date, invoice_ref, notes } = body

  if (!label?.trim()) return NextResponse.json({ error: 'Label is required' }, { status: 400 })

  const { data, error } = await admin
    .from('payment_milestones')
    .insert({
      project_id: id,
      company_id: auth.companyId,
      label: label.trim(),
      amount: amount ? parseFloat(amount) : null,
      currency: currency ?? 'GBP',
      agreed_date: agreed_date || null,
      due_date: due_date || null,
      invoice_ref: invoice_ref?.trim() || null,
      notes: notes?.trim() || null,
      created_by: auth.user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
