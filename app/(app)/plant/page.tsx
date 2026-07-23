export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getCompanyContext } from '@/lib/getCompanyContext'
import PlantClient from '@/components/plant/PlantClient'

export default async function PlantPage() {
  const { supabase, role, effectiveCompanyId, canEdit } = await getCompanyContext()
  if (!['superadmin', 'admin', 'engineer', 'project_manager'].includes(role)) redirect('/dashboard')

  const [
    { data: plant },
    { data: projects },
    { data: sites },
    { data: people },
  ] = await Promise.all([
    supabase
      .from('plant_items')
      .select(`*, project:projects(id, name, location), site:construction_sites(id, name), operator:people(id, name)`)
      .eq('company_id', effectiveCompanyId ?? '')
      .order('name'),
    supabase.from('projects').select('id, name, location').eq('company_id', effectiveCompanyId ?? '').order('name'),
    supabase.from('construction_sites').select('id, name').order('name'),
    supabase.from('people').select('id, name, role').order('name'),
  ])

  return (
    <PlantClient
      plant={plant ?? []}
      projects={projects ?? []}
      sites={sites ?? []}
      people={people ?? []}
      companyId={effectiveCompanyId ?? ''}
      canEdit={canEdit}
    />
  )
}
