import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const adminDb = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, company_id').eq('id', user.id).single()
  if (!['superadmin', 'admin', 'project_manager'].includes((profile as any)?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data } = await adminDb()
    .from('people')
    .select('id, name, email')
    .eq('company_id', (profile as any).company_id)
    .eq('is_active', true)
    .not('email', 'is', null)
    .order('name')

  return NextResponse.json(data ?? [])
}
