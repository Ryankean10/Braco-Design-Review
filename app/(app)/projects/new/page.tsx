import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProjectForm from '@/components/ProjectForm'

export default async function NewProjectPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['superadmin', 'admin', 'engineer', 'project_manager'].includes(profile?.role ?? '')) redirect('/dashboard')

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>New project</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Create a new BESS project</p>
      </div>
      <ProjectForm />
    </div>
  )
}
