export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import { getCompanyContext } from '@/lib/getCompanyContext'
import ProjectForm from '@/components/ProjectForm'

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, role, company } = await getCompanyContext()
  if (!['admin', 'engineer', 'project_manager'].includes(role)) redirect(`/projects/${id}`)

  const { data: project } = await supabase.from('projects').select('*').eq('id', id).single()
  if (!project) notFound()

  const industry: string = (company as any)?.industry ?? 'bess'

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Edit project</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{project.name}</p>
      </div>
      <ProjectForm project={project} industry={industry} />
    </div>
  )
}
