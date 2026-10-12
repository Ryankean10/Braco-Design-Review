export const dynamic = 'force-dynamic'

import { redirect, notFound } from 'next/navigation'
import { getCompanyContext } from '@/lib/getCompanyContext'
import PlantDetail from '@/components/plant/PlantDetail'

export default async function PlantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, role, effectiveCompanyId, canEdit } = await getCompanyContext()
  if (!['superadmin', 'admin', 'engineer', 'project_manager'].includes(role)) redirect('/dashboard')

  const [
    { data: item },
    { data: financials },
    { data: certificates },
    { data: manuals },
    { data: tasks },
    { data: logs },
    { data: projects },
    { data: people },
  ] = await Promise.all([
    supabase.from('plant_items').select(`*, project:projects(id, name, location), site:construction_sites(id, name), operator:people(id, name)`).eq('id', id).single(),
    supabase.from('plant_financials').select('*, project:projects(id, name)').eq('plant_id', id).order('date', { ascending: false }),
    supabase.from('plant_certificates').select('*').eq('plant_id', id).order('expiry_date'),
    supabase.from('plant_manuals').select('*').eq('plant_id', id).order('created_at', { ascending: false }),
    supabase.from('plant_maintenance_tasks').select('*').eq('plant_id', id).order('next_due_date'),
    supabase.from('plant_maintenance_log').select('*').eq('plant_id', id).order('carried_out_date', { ascending: false }),
    supabase.from('projects').select('id, name').eq('company_id', effectiveCompanyId ?? '').order('name'),
    supabase.from('people').select('id, name, role').order('name'),
  ])

  if (!item) notFound()

  return (
    <PlantDetail
      item={item}
      financials={financials ?? []}
      certificates={certificates ?? []}
      manuals={manuals ?? []}
      tasks={tasks ?? []}
      logs={logs ?? []}
      projects={projects ?? []}
      people={people ?? []}
      canEdit={canEdit}
    />
  )
}
