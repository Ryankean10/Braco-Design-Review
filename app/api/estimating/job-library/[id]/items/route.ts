import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

async function auth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params
  const admin = await auth()
  if (!admin) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const body = await req.json()
  const items = Array.isArray(body) ? body : [body]
  const { data, error } = await admin.from('job_library_items').insert(items.map((i: any) => ({ ...i, job_id: jobId }))).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params
  const admin = await auth()
  if (!admin) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { itemId } = await req.json()
  await admin.from('job_library_items').delete().eq('id', itemId).eq('job_id', jobId)
  return NextResponse.json({ ok: true })
}
