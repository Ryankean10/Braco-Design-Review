import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import TechnicalLibrary from '@/components/TechnicalLibrary'

export default async function TechnicalLibraryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = (profile as any)?.role ?? ''

  // Clients have no access to technical library
  if (role === 'client') notFound()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, client, stage')
    .eq('id', id)
    .single()
  if (!project) notFound()

  const { data: docs } = await supabase
    .from('technical_documents')
    .select('*, tech_doc_analyses(id, status, findings, raw_summary, error, created_at, completed_at)')
    .eq('project_id', id)
    .order('created_at', { ascending: false })

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/projects/${id}`} className="transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={18} />
        </Link>
        <BookOpen size={20} style={{ color: 'var(--accent)' }} />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Technical Information</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {project.name} · Received manuals, studies &amp; technical documents
          </p>
        </div>
      </div>

      <div className="mb-4 px-4 py-3 rounded-xl text-xs leading-relaxed"
        style={{ background: 'rgba(108,114,245,0.08)', border: '1px solid rgba(108,114,245,0.2)', color: 'var(--text-muted)' }}>
        <strong style={{ color: 'var(--accent)' }}>AI analysis</strong> — upload a PDF manual or study and click
        <strong style={{ color: 'var(--accent)' }}> Analyse</strong> to extract specifications, flag compliance
        cross-checks against design documents, and surface relevant lessons learned.
      </div>

      <TechnicalLibrary
        projectId={id}
        initialDocs={(docs ?? []) as any}
        userRole={role}
      />
    </div>
  )
}
