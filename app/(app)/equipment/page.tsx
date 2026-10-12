export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getCompanyContext } from '@/lib/getCompanyContext'
import EquipmentClient from '@/components/equipment/EquipmentClient'

export default async function EquipmentPage() {
  const { supabase, role, effectiveCompanyId, canEdit } = await getCompanyContext()
  if (!['superadmin', 'admin', 'engineer', 'project_manager'].includes(role)) redirect('/dashboard')

  const { data: items } = await supabase
    .from('equipment_items')
    .select('*')
    .eq('company_id', effectiveCompanyId ?? '')
    .order('category')
    .order('name')

  return (
    <EquipmentClient
      initialItems={items ?? []}
      companyId={effectiveCompanyId ?? ''}
      canEdit={canEdit}
    />
  )
}
