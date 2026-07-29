export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import TeamClient from '@/components/team/TeamClient'

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role, company_id').eq('id', user.id).single()
  const role = (profile as any)?.role ?? ''
  const companyId: string = (profile as any)?.company_id ?? ''
  if (!['superadmin', 'admin', 'engineer', 'project_manager'].includes(role)) redirect('/dashboard')

  // Fetch projects first so we can scope sites by project IDs
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, client')
    .eq('company_id', companyId)
    .order('name')

  const projectIds = (projects ?? []).map(p => p.id)

  const [{ data: people }, { data: appointments }, { data: sites }] = await Promise.all([
    supabase.from('people').select('*').eq('company_id', companyId).order('name'),
    supabase.from('job_appointments').select(`
      *,
      person:people(id, name, role, discipline, company),
      project:projects(id, name, client),
      site:construction_sites(id, name, client)
    `).eq('appointed_by', user.id).order('created_at', { ascending: false }),
    supabase.from('construction_sites')
      .select('id, name, client, project_id')
      .in('project_id', projectIds.length > 0 ? projectIds : ['00000000-0000-0000-0000-000000000000'])
      .order('name'),
  ])

  return (
    <Suspense>
      <TeamClient
        people={people ?? []}
        appointments={appointments ?? []}
        projects={projects ?? []}
        sites={sites ?? []}
        currentUserId={user.id}
        canEdit={['superadmin', 'admin', 'engineer', 'project_manager'].includes(role)}
        userRole={role}
      />
    </Suspense>
  )
}
