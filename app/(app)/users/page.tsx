import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import UsersClient from '@/components/UsersClient'

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role, company_id').eq('id', user.id).single()
  if (!['superadmin', 'admin'].includes(profile?.role ?? '')) redirect('/dashboard')
  const companyId: string = (profile as any)?.company_id ?? ''

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
    // Service role — filter by company_id explicitly
    admin.from('profiles').select('id, email, full_name, role, created_at').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('projects').select('id, name, client').eq('company_id', companyId).order('name'),
    supabase.from('project_members').select('project_id, user_id'),
    supabase.from('project_clients').select('project_id, user_id'),
  ])

  // Build project assignment map: userId → projectId[]
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
    />
  )
}
