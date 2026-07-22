import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import TeamClient from '@/components/team/TeamClient'

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = (profile as any)?.role ?? ''
  if (!['superadmin', 'admin', 'engineer', 'project_manager'].includes(role)) redirect('/dashboard')

  // Fetch people library (all authenticated can read)
  const { data: people } = await supabase
    .from('people')
    .select('*')
    .order('name')

  // Fetch this user's appointments with joined person + project/site names
  const { data: appointments } = await supabase
    .from('job_appointments')
    .select(`
      *,
      person:people(id, name, role, discipline, company),
      project:projects(id, name, client),
      site:construction_sites(id, name, client)
    `)
    .eq('appointed_by', user.id)
    .order('created_at', { ascending: false })

  // Fetch projects + sites for appointment dropdown
  const [{ data: projects }, { data: sites }] = await Promise.all([
    supabase.from('projects').select('id, name, client').order('name'),
    supabase.from('construction_sites').select('id, name, client').order('name'),
  ])

  return (
    <Suspense>
      <TeamClient
        people={people ?? []}
        appointments={appointments ?? []}
        projects={projects ?? []}
        sites={sites ?? []}
        currentUserId={user.id}
        canEdit={['admin', 'engineer', 'project_manager'].includes(role)}
      />
    </Suspense>
  )
}
