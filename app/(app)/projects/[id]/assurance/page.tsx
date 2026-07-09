export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck, ClipboardList, FileCheck2 } from 'lucide-react'
import ProjectITPUpload from '@/components/ProjectITPUpload'
import GenerateQcsButton from '@/components/assurance/GenerateQcsButton'
import QcsDocList from '@/components/assurance/QcsDocList'

export default async function AssurancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: project }, { data: profile }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
  ])

  if (!project) notFound()

  const role = profile?.role ?? 'engineer'
  if (role === 'client') redirect(`/projects/${id}`)

  const canEdit = ['admin', 'engineer'].includes(role)

  const [{ data: projectItps }, { data: constructionSite }, { data: qcsDocs }] = await Promise.all([
    supabase.from('project_itps').select('*').eq('project_id', id).order('uploaded_at', { ascending: false }),
    supabase.from('construction_sites').select('id').eq('project_id', id).maybeSingle(),
    supabase.from('qcs_documents')
      .select('id, title, reference_no, status, location, generated_by_name, approved_by_name, pdf_storage_path')
      .eq('project_id', id)
      .order('reference_no', { ascending: true }),
  ])

  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/projects/${id}`} className="transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} style={{ color: '#22c55e' }} />
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Project Assurance</h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {project.name} · {project.client}
          </p>
        </div>
      </div>

      {/* ── QCS Section ─────────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileCheck2 size={16} style={{ color: '#22c55e' }} />
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Quality Check Sheets
            </h2>
            {(qcsDocs ?? []).length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ background: '#22c55e22', color: '#22c55e' }}>
                {(qcsDocs ?? []).length}
              </span>
            )}
          </div>
          {canEdit && (projectItps ?? []).length > 0 && (
            <GenerateQcsButton projectId={id} />
          )}
        </div>

        {(qcsDocs ?? []).length === 0 ? (
          <div className="rounded-xl border p-10 text-center"
            style={{ borderColor: 'var(--border)', borderStyle: 'dashed', background: 'var(--bg-surface)' }}>
            <FileCheck2 size={32} className="mx-auto mb-3" style={{ color: '#334155' }} />
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No QCS documents yet</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Upload an ITP then click Generate QCS Pack to produce a quality check sheet for each activity.
            </p>
          </div>
        ) : (
          <QcsDocList
            projectId={id}
            docs={qcsDocs as any}
            canEdit={canEdit}
          />
        )}
      </section>

      {/* ── ITP Section ─────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList size={16} style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Inspection &amp; Test Plan
          </h2>
        </div>
        <ProjectITPUpload
          projectId={id}
          siteId={(constructionSite as any)?.id ?? null}
          initialItps={(projectItps ?? []) as any}
          canEdit={canEdit}
          userRole={role}
        />
      </section>

    </div>
  )
}
