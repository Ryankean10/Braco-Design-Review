import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, INTERNAL_ROLES } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const auth = await requireRole(INTERNAL_ROLES)
  if ('error' in auth) return auth.error

  const { siteId } = await params
  const supabase = await createClient()

  const { data: activities, error } = await supabase
    .from('civils_activities')
    .select('*')
    .eq('site_id', siteId)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ activities })
}
