import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_PACKAGES = [
  { name: 'AC Battery Cable',  package_type: 'cable',          sort_order: 1 },
  { name: 'DC String Cable',   package_type: 'cable',          sort_order: 2 },
  { name: 'LV Cable',          package_type: 'cable',          sort_order: 3 },
  { name: 'Comms / Multicore', package_type: 'cable',          sort_order: 4 },
  { name: 'HV Cable',          package_type: 'cable',          sort_order: 5 },
  { name: 'Containment',       package_type: 'containment',    sort_order: 6 },
  { name: 'Civils',            package_type: 'civils',         sort_order: 7 },
  { name: 'Commissioning',     package_type: 'commissioning',  sort_order: 8 },
]

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = (profile as any)?.role ?? ''
  if (!['admin', 'engineer', 'project_manager'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { projectId } = await request.json()
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  // Check a site doesn't already exist for this project
  const { data: existing } = await supabase
    .from('construction_sites')
    .select('id')
    .eq('project_id', projectId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ siteId: existing.id, already_existed: true })
  }

  // Fetch project details to populate the site
  const { data: project, error: projErr } = await supabase
    .from('projects')
    .select('name, client, location, capacity_mw')
    .eq('id', projectId)
    .single()

  if (projErr || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Create construction site
  const { data: site, error: siteErr } = await supabase
    .from('construction_sites')
    .insert({
      project_id:  projectId,
      name:        project.name,
      client:      project.client,
      location:    project.location,
      capacity_mw: project.capacity_mw,
      status:      'mobilising',
      created_by:  user.id,
    })
    .select('id')
    .single()

  if (siteErr || !site) {
    return NextResponse.json({ error: siteErr?.message ?? 'Failed to create site' }, { status: 500 })
  }

  // Create default packages
  await supabase.from('construction_packages').insert(
    DEFAULT_PACKAGES.map(p => ({ ...p, site_id: site.id }))
  )

  // Civils activities are NOT auto-seeded — they are created from the project ITP
  // once received, to ensure the register reflects the actual scope of works.

  return NextResponse.json({ siteId: site.id, already_existed: false })
}
