export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getCompanyContext } from '@/lib/getCompanyContext'
import ProjectForm from '@/components/ProjectForm'

export default async function NewProjectPage() {
  const { user, role, company } = await getCompanyContext()
  if (!user) redirect('/login')
  if (!['superadmin', 'admin', 'engineer', 'project_manager'].includes(role)) redirect('/dashboard')

  const industry: string = (company as any)?.industry ?? 'bess'
  const isCivils = industry === 'civils'

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>New project</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {isCivils ? 'Create a new civils project' : 'Create a new BESS project'}
        </p>
      </div>
      <ProjectForm industry={industry} />
    </div>
  )
}
