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
  if (!ctx) return NextResponse.json({ people: {}, plant: {} })

  // Get the current estimate's dates
  const { data: est } = await ctx.admin
    .from('estimates')
    .select('start_date, end_date, company_id')
    .eq('id', id)
    .single()

  if (!est?.start_date || !est?.end_date) {
    return NextResponse.json({ people: {}, plant: {}, noDateRange: true })
  }

  // Find all OTHER active estimates for this company with overlapping dates
  const { data: overlapping } = await ctx.admin
    .from('estimates')
    .select('id, reference, title')
    .eq('company_id', est.company_id)
    .neq('id', id)
    .not('status', 'in', '("rejected","void")')
    .not('start_date', 'is', null)
    .not('end_date', 'is', null)
    .lte('start_date', est.end_date)
    .gte('end_date', est.start_date)

  if (!overlapping?.length) return NextResponse.json({ people: {}, plant: {} })

  const overlapIds = overlapping.map((e: any) => e.id)
  const estMap = Object.fromEntries(overlapping.map((e: any) => [e.id, { reference: e.reference, title: e.title }]))

  // Get items from overlapping estimates that have person_id or plant_item_id set
  const { data: clashItems } = await ctx.admin
    .from('estimate_items')
    .select('person_id, plant_item_id, estimate_id')
    .in('estimate_id', overlapIds)

  // Build clash maps: personId → [{reference, title}], plantItemId → [{reference, title}]
  const people: Record<string, { reference: string; title: string }[]> = {}
  const plant:  Record<string, { reference: string; title: string }[]> = {}

  for (const item of clashItems ?? []) {
    const meta = estMap[item.estimate_id]
    if (!meta) continue
    if (item.person_id) {
      people[item.person_id] = people[item.person_id] ?? []
      if (!people[item.person_id].some(x => x.reference === meta.reference))
        people[item.person_id].push(meta)
    }
    if (item.plant_item_id) {
      plant[item.plant_item_id] = plant[item.plant_item_id] ?? []
      if (!plant[item.plant_item_id].some(x => x.reference === meta.reference))
        plant[item.plant_item_id].push(meta)
    }
  }

  return NextResponse.json({ people, plant })
}
