export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileQuestion } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import RfiTqPanel from '@/components/rfi-tq/RfiTqPanel'

export default async function RfiTqPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: project }, { data: profile }] = await Promise.all([
    supabase.from('projects').select('id, name, client, location').eq('id', projectId).single(),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
  ])

  if (!project) notFound()
  const role = profile?.role ?? 'engineer'
  if (role === 'client') redirect(`/projects/${projectId}`)

  const { data: items } = await supabase
    .from('rfis_tqs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  const canEdit = ['superadmin', 'admin', 'engineer', 'project_manager'].includes(role)

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/projects/${projectId}`} className="hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={18} />
        </Link>
        <FileQuestion size={20} style={{ color: 'var(--accent)' }} />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>RFI / TQ Register</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {project.name} · {project.client}
          </p>
        </div>
      </div>

      <RfiTqPanel
        projectId={projectId}
        initialItems={(items ?? []) as any}
        canEdit={canEdit}
      />
    </div>
  )
}
