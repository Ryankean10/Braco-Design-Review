export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck, ClipboardList, FileCheck2, Plus } from 'lucide-react'
import ProjectITPUpload from '@/components/ProjectITPUpload'

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
    supabase.from('qcs_documents').select('*').eq('project_id', id).order('created_at', { ascending: false }),
  ])

  const openQcs     = (qcsDocs ?? []).filter((q: any) => q.status === 'wip' || q.status === 'act_review')
  const submittedQcs = (qcsDocs ?? []).filter((q: any) => q.status === 'submitted')

  const statusColor: Record<string, string> = {
    wip:        '#f59e0b',
    act_review: '#6366f1',
    submitted:  '#22c55e',
  }
  const statusLabel: Record<string, string> = {
    wip:        'WIP',
    act_review: 'ACT Review',
    submitted:  'Submitted to Client',
  }

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
          {canEdit && (
            <button
              disabled
              title="Upload your QCS template first"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium opacity-40 cursor-not-allowed"
              style={{ background: '#22c55e', color: '#0f172a' }}>
              <Plus size={12} /> New QCS
            </button>
          )}
        </div>

        {(qcsDocs ?? []).length === 0 ? (
          <div className="rounded-xl border p-10 text-center"
            style={{ borderColor: 'var(--border)', borderStyle: 'dashed', background: 'var(--bg-surface)' }}>
            <FileCheck2 size={32} className="mx-auto mb-3" style={{ color: '#334155' }} />
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No QCS documents yet</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              QCS templates are being configured. Once ready, you can generate a Quality Check Sheet for each ITP activity.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Active/draft QCS */}
            {openQcs.length > 0 && (
              <div className="space-y-2 mb-4">
                <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>In progress</p>
                {openQcs.map((q: any) => (
                  <div key={q.id} className="rounded-xl border px-5 py-3.5 flex items-center gap-4"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{q.title}</p>
                        <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>{q.reference_no}</span>
                      </div>
                      {q.location && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{q.location}</p>}
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                      style={{ background: (statusColor[q.status] ?? '#64748b') + '22', color: statusColor[q.status] ?? '#64748b' }}>
                      {statusLabel[q.status] ?? q.status}
                    </span>
                    <p className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{q.generated_by_name ?? '—'}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Submitted QCS */}
            {submittedQcs.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Submitted to Client</p>
                {submittedQcs.map((q: any) => (
                  <div key={q.id} className="rounded-xl border px-5 py-3.5 flex items-center gap-4"
                    style={{ background: '#0d2818', borderColor: '#22c55e33' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{q.title}</p>
                        <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>{q.reference_no}</span>
                      </div>
                      {q.location && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{q.location}</p>}
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                      style={{ background: '#22c55e22', color: '#22c55e' }}>
                      Submitted to Client
                    </span>
                    <p className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{q.approved_by_name ?? '—'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
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
