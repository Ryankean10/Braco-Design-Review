export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getCompanyContext } from '@/lib/getCompanyContext'
import { createClient as createAdmin } from '@supabase/supabase-js'
import ResourceScheduleClient from '@/components/ResourceScheduleClient'

export default async function ResourceSchedulePage() {
  const { user, profile, company, effectiveCompanyId, role } = await getCompanyContext()

  if (!user) redirect('/login')
  if (!company?.modules?.includes('planning')) redirect('/dashboard')
  if (role === 'client' || role === 'operative') redirect('/dashboard')

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const startDate = new Date()
  startDate.setHours(0, 0, 0, 0)
  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + 13)

  const startStr = startDate.toISOString().split('T')[0]
  const endStr   = endDate.toISOString().split('T')[0]

  const [{ data: people }, { data: projects }, { data: assignments }] = await Promise.all([
    effectiveCompanyId
      ? admin.from('people').select('id, name, role').eq('company_id', effectiveCompanyId).order('name')
      : Promise.resolve({ data: [] }),
    effectiveCompanyId
      ? admin.from('projects').select('id, name').eq('company_id', effectiveCompanyId).order('name')
      : Promise.resolve({ data: [] }),
    effectiveCompanyId
      ? admin.from('resource_assignments')
          .select('id, person_id, project_id, site_id, assign_date, role_on_day, notes')
          .eq('company_id', effectiveCompanyId)
          .gte('assign_date', startStr)
          .lte('assign_date', endStr)
      : Promise.resolve({ data: [] }),
  ])

  return (
    <div className="p-8 max-w-full mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Resource Schedule</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>2-week rolling view — {startDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} to {endDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
      </div>
      <ResourceScheduleClient
        people={people ?? []}
        projects={projects ?? []}
        assignments={assignments ?? []}
        startDate={startStr}
        companyId={effectiveCompanyId ?? ''}
        canEdit={['admin', 'engineer', 'project_manager', 'superadmin'].includes(role)}
      />
    </div>
  )
}
