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
  return { admin, profile, userId: user.id }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await auth()
  if (!ctx) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Fetch the current estimate + items
  const { data: src } = await ctx.admin
    .from('estimates')
    .select('*, estimate_items(*)')
    .eq('id', id)
    .single()
  if (!src) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Determine root and new revision number
  const rootId = src.root_estimate_id ?? src.id

  // Find the highest revision in this family
  const { data: siblings } = await ctx.admin
    .from('estimates')
    .select('revision')
    .or(`id.eq.${rootId},root_estimate_id.eq.${rootId}`)
  const maxRevision = Math.max(...(siblings ?? []).map((s: any) => s.revision ?? 1))
  const newRevision = maxRevision + 1

  // Derive new reference: base off the root's reference
  const { data: root } = await ctx.admin.from('estimates').select('reference').eq('id', rootId).single()
  const baseRef = root?.reference ?? src.reference
  // Strip any previous " Rev.N" suffix
  const cleanRef = baseRef.replace(/ Rev\.\d+$/, '')
  const newRef = `${cleanRef} Rev.${newRevision}`

  // Create the new estimate
  const { data: newEst, error: estErr } = await ctx.admin
    .from('estimates')
    .insert({
      company_id:         src.company_id,
      title:              src.title,
      description:        src.description,
      client_name:        src.client_name,
      client_email:       src.client_email,
      reference:          newRef,
      status:             'draft',
      project_id:         src.project_id,
      start_date:         src.start_date,
      end_date:           src.end_date,
      notes:              src.notes,
      default_markup_pct: src.default_markup_pct,
      revision:           newRevision,
      root_estimate_id:   rootId,
      created_by:         ctx.userId,
    })
    .select()
    .single()
  if (estErr || !newEst) return NextResponse.json({ error: estErr?.message ?? 'Failed to create revision' }, { status: 500 })

  // Copy all items
  const items = (src.estimate_items ?? []).map((i: any) => ({
    estimate_id:   newEst.id,
    section:       i.section,
    description:   i.description,
    quantity:      i.quantity,
    unit:          i.unit,
    unit_cost:     i.unit_cost,
    markup_pct:    i.markup_pct,
    person_id:     i.person_id,
    plant_item_id: i.plant_item_id,
    is_hire:       i.is_hire,
    sort_order:    i.sort_order,
    notes:         i.notes,
  }))
  if (items.length) {
    await ctx.admin.from('estimate_items').insert(items)
  }

  return NextResponse.json({ id: newEst.id, reference: newRef })
}
