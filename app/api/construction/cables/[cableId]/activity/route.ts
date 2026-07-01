import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH — update or create an activity on a cable
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ cableId: string }> }) {
  const { cableId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { activity, end_side, status, completed_by, notes, needs_review } = await req.json()
  if (!activity || !status) return NextResponse.json({ error: 'activity and status required' }, { status: 400 })

  // Get the cable to find site_id
  const { data: cable } = await supabase.from('cable_items').select('site_id').eq('id', cableId).single()
  if (!cable) return NextResponse.json({ error: 'Cable not found' }, { status: 404 })

  // Upsert the activity row
  const { data, error } = await supabase
    .from('cable_activities')
    .upsert({
      cable_id: cableId,
      site_id: cable.site_id,
      activity,
      end_side: end_side ?? null,
      status,
      completed_by: completed_by ?? null,
      completed_at: status === 'Complete' ? new Date().toISOString() : null,
      notes: notes ?? null,
      needs_review: needs_review ?? false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'cable_id,activity,coalesce(end_side,\'\')' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Recompute cable completion % and status
  const { data: allActs } = await supabase
    .from('cable_activities')
    .select('status')
    .eq('cable_id', cableId)

  if (allActs && allActs.length > 0) {
    const complete = allActs.filter(a => a.status === 'Complete').length
    const pct = complete / allActs.length
    const blocked = allActs.some(a => a.status === 'Blocked')
    const rework  = allActs.some(a => a.status === 'Rework')
    const inprog  = allActs.some(a => a.status === 'In Progress' || a.status === 'Complete')
    const overallStatus =
      pct === 1         ? 'Complete'     :
      blocked           ? 'Blocked'      :
      rework            ? 'Rework'       :
      inprog            ? 'In Progress'  : 'Not Started'

    await supabase
      .from('cable_items')
      .update({ completion_pct: pct, overall_status: overallStatus, updated_at: new Date().toISOString() })
      .eq('id', cableId)
  }

  return NextResponse.json(data)
}
