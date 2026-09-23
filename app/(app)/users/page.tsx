import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { getCompanyContext } from '@/lib/getCompanyContext'
import UsersClient from '@/components/UsersClient'

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role, company_id').eq('id', user.id).single()
  if (!['superadmin', 'admin'].includes(profile?.role ?? '')) redirect('/dashboard')

  // Users list uses the caller's own company_id — stable, never null
  const listCompanyId: string = (profile as any)?.company_id ?? ''

  // Subdomain company ID — used only for invites so new users land in the right tenant
  const { company } = await getCompanyContext()
  const inviteCompanyId: string = (company as any)?.id ?? listCompanyId

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const [
    { data: profiles },
    { data: projects },
    { data: members },
    { data: clients },
  ] = await Promise.all([
    admin.from('profiles').select('id, email, full_name, role, created_at').eq('company_id', listCompanyId).order('created_at', { ascending: false }),
    supabase.from('projects').select('id, name, client').eq('company_id', listCompanyId).order('name'),
    supabase.from('project_members').select('project_id, user_id'),
    supabase.from('project_clients').select('project_id, user_id'),
  ])

  const assignmentMap: Record<string, string[]> = {}
  for (const m of [...(members ?? []), ...(clients ?? [])]) {
    if (!assignmentMap[m.user_id]) assignmentMap[m.user_id] = []
    assignmentMap[m.user_id].push(m.project_id)
  }

  return (
    <UsersClient
      users={profiles ?? []}
      projects={projects ?? []}
      assignmentMap={assignmentMap}
      currentUserId={user.id}
      companyId={inviteCompanyId}
    />
  )
}
