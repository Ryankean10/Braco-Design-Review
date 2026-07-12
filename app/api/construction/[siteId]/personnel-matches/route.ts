import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, MANAGER_ROLES } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET: return all unique diary names for this site, with current match state
export async function GET(_req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  const auth = await requireRole(MANAGER_ROLES)
  if ('error' in auth) return auth.error
  const supabase = await createClient()

  // Unique names from timesheet_entries (diary source only)
  const { data: entries } = await supabase
    .from('timesheet_entries')
    .select('person_name, person_id, timesheet:timesheets(source)')
    .eq('site_id', siteId)

  // Aggregate: unique name → auto-matched person_id (if any)
  const nameMap = new Map<string, string | null>()
  for (const e of entries ?? []) {
    const ts = Array.isArray(e.timesheet) ? e.timesheet[0] : e.timesheet
    if ((ts as any)?.source !== 'diary') continue
    if (!nameMap.has(e.person_name)) nameMap.set(e.person_name, e.person_id ?? null)
  }

  // Load existing manual mappings
  const { data: mappings } = await supabase
    .from('diary_name_mappings')
    .select('raw_name, person_id, no_match, person:people(id,name,role,company)')
    .eq('site_id', siteId)

  const mappingMap = new Map((mappings ?? []).map(m => [m.raw_name, m]))

  const result = [...nameMap.entries()].map(([raw_name, auto_person_id]) => {
    const manual = mappingMap.get(raw_name)
    return {
      raw_name,
      auto_person_id,
      manual_person_id: manual?.person_id ?? null,
      no_match: manual?.no_match ?? false,
      person: manual?.person ?? null,
    }
  }).sort((a, b) => {
    // Unresolved first, then alphabetical
    const aResolved = a.no_match || a.manual_person_id || a.auto_person_id
    const bResolved = b.no_match || b.manual_person_id || b.auto_person_id
    if (!!aResolved !== !!bResolved) return aResolved ? 1 : -1
    return a.raw_name.localeCompare(b.raw_name)
  })

  return NextResponse.json(result)
}

// POST: save a manual match (or no_match flag) for a name, then update timesheet_entries
export async function POST(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  const auth = await requireRole(MANAGER_ROLES)
  if ('error' in auth) return auth.error
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { raw_name, person_id, no_match } = await req.json()
  if (!raw_name) return NextResponse.json({ error: 'raw_name required' }, { status: 400 })

  // Upsert mapping
  const { error: upsertErr } = await supabase
    .from('diary_name_mappings')
    .upsert({
      site_id: siteId,
      raw_name,
      person_id: no_match ? null : (person_id ?? null),
      no_match: no_match ?? false,
      confirmed_by: user.id,
      confirmed_at: new Date().toISOString(),
    }, { onConflict: 'site_id,raw_name' })

  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })

  // Propagate person_id to all timesheet_entries for this site+name
  const { error: updateErr } = await supabase
    .from('timesheet_entries')
    .update({ person_id: no_match ? null : (person_id ?? null) })
    .eq('site_id', siteId)
    .eq('person_name', raw_name)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// DELETE: remove a name entirely — wipes timesheet entries and strips from ai_personnel arrays
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  const auth = await requireRole(MANAGER_ROLES)
  if ('error' in auth) return auth.error
  const supabase = await createClient()

  const { raw_name } = await req.json()
  if (!raw_name) return NextResponse.json({ error: 'raw_name required' }, { status: 400 })

  // Delete timesheet entries for this name on this site
  await supabase.from('timesheet_entries')
    .delete()
    .eq('site_id', siteId)
    .eq('person_name', raw_name)

  // Remove name from ai_personnel arrays in site_diaries
  // PostgreSQL: filter the JSONB array to exclude this name
  await supabase.rpc('remove_diary_personnel_name', { p_site_id: siteId, p_name: raw_name })

  // Remove the mapping record
  await supabase.from('diary_name_mappings')
    .delete()
    .eq('site_id', siteId)
    .eq('raw_name', raw_name)

  return NextResponse.json({ ok: true })
}
