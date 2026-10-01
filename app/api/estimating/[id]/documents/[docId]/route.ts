import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

async function auth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: profile } = await admin.from('profiles').select('role, company_id').eq('id', user.id).single()
  if (!profile) return null
  return { admin, profile, supabase, userId: user.id }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { docId } = await params
  const ctx = await auth()
  if (!ctx) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: doc } = await ctx.admin.from('estimate_documents').select('storage_path').eq('id', docId).single()
  if (doc) {
    await ctx.admin.storage.from('estimate-documents').remove([doc.storage_path])
  }

  const { error } = await ctx.admin.from('estimate_documents').delete().eq('id', docId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
