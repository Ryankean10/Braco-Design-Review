import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

async function auth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  return admin
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id: estimateId, itemId } = await params
  const admin = await auth()
  if (!admin) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const body = await req.json()
  const { data, error } = await admin
    .from('estimate_items')
    .update(body)
    .eq('id', itemId)
    .eq('estimate_id', estimateId)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id: estimateId, itemId } = await params
  const admin = await auth()
  if (!admin) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  await admin.from('estimate_items').delete().eq('id', itemId).eq('estimate_id', estimateId)
  return NextResponse.json({ ok: true })
}
