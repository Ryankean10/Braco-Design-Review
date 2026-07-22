export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PlantClient from '@/components/plant/PlantClient'

export default async function PlantPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role, company_id').eq('id', user.id).single()
  const role = (profile as any)?.role ?? ''
  if (!['superadmin', 'admin', 'engineer', 'project_manager'].includes(role)) redirect('/dashboard')

  const companyId = (profile as any)?.company_id as string | null

  const [
    { data: plant },
    { data: projects },
    { data: sites },
    { data: people },
  ] = await Promise.all([
    supabase
      .from('plant_items')
      .select(`*, project:projects(id, name, location), site:construction_sites(id, name), operator:people(id, name)`)
      .order('name'),
    supabase.from('projects').select('id, name, location').order('name'),
    supabase.from('construction_sites').select('id, name').order('name'),
    supabase.from('people').select('id, name, role').order('name'),
  ])

  return (
    <PlantClient
      plant={plant ?? []}
      projects={projects ?? []}
      sites={sites ?? []}
      people={people ?? []}
      companyId={companyId ?? ''}
      canEdit={['superadmin', 'admin', 'engineer', 'project_manager'].includes(role)}
    />
  )
}
