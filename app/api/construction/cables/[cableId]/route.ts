import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH — update cable-level fields (flagged, containment_route, notes)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ cableId: string }> }) {
  const { cableId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

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
