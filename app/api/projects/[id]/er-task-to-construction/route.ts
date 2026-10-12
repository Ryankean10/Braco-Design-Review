import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { requireRole, INTERNAL_ROLES } from '@/lib/auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const auth = await requireRole(INTERNAL_ROLES)
  if ('error' in auth) return auth.error
  const supabase = await createClient()

  const { taskId, siteId } = await req.json()
  if (!taskId || !siteId) return NextResponse.json({ error: 'taskId and siteId required' }, { status: 400 })

  const { data: task } = await supabase.from('er_tasks').select('*').eq('id', taskId).single()
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  // Get highest sort_order in this site
  const { data: maxRow } = await supabase
    .from('civils_activities')
    .select('sort_order')
    .eq('site_id', siteId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = ((maxRow as any)?.sort_order ?? 0) + 1

  const { data: activity, error } = await supabase.from('civils_activities').insert({
    site_id: siteId,
    activity_group: task.category ?? 'General',
    description: task.task_text,
    category: 'Above Ground',
    discipline: 'Civils',
    sort_order: nextOrder,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('er_tasks').update({
    added_to_construction: true,
    construction_activity_id: activity.id,
  }).eq('id', taskId)

  return NextResponse.json({ activityId: activity.id })
}
