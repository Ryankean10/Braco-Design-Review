import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import TestRegisterClient from '@/components/TestRegisterClient'

export default async function TestRegisterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: project }, { data: profile }, { data: tests }] = await Promise.all([
    supabase.from('projects').select('id, name, client').eq('id', projectId).single(),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase
      .from('test_register')
      .select('*, test_documents(*)')
      .eq('project_id', projectId)
      .order('planned_date', { ascending: true }),
  ])

  if (!project) notFound()
  if (profile?.role === 'client') redirect(`/projects/${projectId}`)

  const canEdit = ['admin', 'engineer'].includes(profile?.role ?? '')

  return (
    <TestRegisterClient
      project={project}
      tests={tests ?? []}
      canEdit={canEdit}
      userId={user.id}
    />
  )
}
