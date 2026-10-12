import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, INTERNAL_ROLES } from '@/lib/auth'

// PATCH — update cable-level fields (flagged, containment_route, notes)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ cableId: string }> }) {
  const { cableId } = await params
  const auth = await requireRole(INTERNAL_ROLES)
  if ('error' in auth) return auth.error
  const supabase = await createClient()

  const body = await req.json()
  const allowed = ['flagged', 'flag_reason', 'containment_route', 'notes']
  const update: Record<string, any> = { updated_at: new Date().toISOString() }
  for (const k of allowed) {
    if (k in body) update[k] = body[k]
  }

  const { data, error } = await supabase
    .from('cable_items')
    .update(update)
    .eq('id', cableId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
