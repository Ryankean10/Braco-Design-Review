import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const { data: profile } = await admin
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()
  if (!['admin', 'superadmin', 'project_manager'].includes(profile?.role ?? '')) return null
  return { admin, user, profile }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const update: Record<string, any> = {}

  if (body.status === 'approved') {
    update.status = 'approved'
    update.approved_by = ctx.user.id
    update.approved_at = new Date().toISOString()
  } else if (body.status === 'rejected') {
    update.status = 'rejected'
    update.rejection_reason = body.rejection_reason ?? null
    update.approved_by = ctx.user.id
    update.approved_at = new Date().toISOString()
  } else {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { error } = await ctx.admin
    .from('timesheet_submissions')
    .update(update)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
