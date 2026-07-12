import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import DocumentLibrary from '@/components/DocumentLibrary'

export default async function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (!project) notFound()

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('project_id', id)
    .order('uploaded_at', { ascending: false })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role === 'client') redirect(`/projects/${id}`)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/projects/${id}`} className="transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Document Library</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{project.name}</p>
        </div>
      </div>

      <DocumentLibrary
        projectId={id}
        projectStage={project.stage}
        initialDocuments={documents ?? []}
        userRole={profile?.role ?? 'engineer'}
      />
    </div>
  )
}
