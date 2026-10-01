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
  return { admin, profile }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await auth()
  if (!ctx) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Find the root of this family
  const { data: src } = await ctx.admin.from('estimates').select('root_estimate_id').eq('id', id).single()
  if (!src) return NextResponse.json([])
  const rootId = src.root_estimate_id ?? id

  // Fetch all members of this revision family
  const { data: revisions } = await ctx.admin
    .from('estimates')
    .select('id, reference, revision, status, created_at, estimate_items(total_cost, markup_pct)')
    .or(`id.eq.${rootId},root_estimate_id.eq.${rootId}`)
    .order('revision', { ascending: true })

  return NextResponse.json(revisions ?? [])
}
