import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { getCompanyContext } from '@/lib/getCompanyContext'
import UsersClient from '@/components/UsersClient'

export default async function UsersPage() {
  const { user, role, effectiveCompanyId } = await getCompanyContext()
  if (!user) redirect('/login')
  if (!['superadmin', 'admin'].includes(role ?? '')) redirect('/dashboard')

  const companyId = effectiveCompanyId ?? ''

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const [
    { data: profiles },
    { data: projects },
    { data: members },
    { data: clients },
  ] = await Promise.all([
    admin.from('profiles').select('id, email, full_name, role, created_at').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('projects').select('id, name, client').eq('company_id', companyId).order('name'),
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
      companyId={companyId}
    />
  )
}
