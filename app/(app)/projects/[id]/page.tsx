export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil, FileText, ShoppingCart, FlaskConical, MessageSquare, Sparkles, AlertTriangle, Zap, BookMarked, BookOpen, TrendingUp, ShieldCheck } from 'lucide-react'
import type { Stage } from '@/lib/types'
import ProjectReferences from '@/components/ProjectReferences'
import ProjectER from '@/components/ProjectER'
import ClientProjectView from '@/components/ClientProjectView'
import InternalCommentPanel from '@/components/InternalCommentPanel'
import ProjectStageTracker from '@/components/ProjectStageTracker'
import ClientAccessPanel from '@/components/ClientAccessPanel'
import { makeDefaultStages, STAGE_ORDER as STAGE_NAMES } from '@/lib/stageDefaults'
import ProjectITPUpload from '@/components/ProjectITPUpload'

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
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

  // ── Client view ────────────────────────────────────────────────────────────
  if (role === 'client') {
    // Check this client is assigned to this project
    const { data: assignment } = await supabase
      .from('project_clients')
      .select('id')
      .eq('project_id', id)
      .eq('user_id', user.id)
      .single()
    if (!assignment) notFound()

    const [{ data: docs }, { data: tests }, { data: comments }, { data: clientStageRows }, { data: notifications }] = await Promise.all([
      supabase.from('documents')
        .select('id, doc_no, title, rev, type, storage_path, file_name, client_review_note, doc_status')
        .eq('project_id', id)
        .eq('doc_status', 'Ready for Client Review')
        .order('doc_no'),
      supabase.from('test_register')
        .select('id, test_ref, title, category, test_type, planned_date, actual_date, location, status, result_summary, witnessed_by, certificate_ref, itp_ref')
        .eq('project_id', id)
        .not('status', 'in', '("Planned","Cancelled")')
        .order('actual_date', { ascending: false }),
      supabase.from('client_comments')
        .select('*')
        .eq('project_id', id)
        .eq('created_by', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('project_stages')
        .select('stage, status')
        .eq('project_id', id),
      // Unread notifications for this client on this project
      supabase.from('notifications')
        .select('id, document_id, title, body, created_at, read_at')
        .eq('user_id', user.id)
        .eq('project_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    const docIds = (docs ?? []).map((d: any) => d.id as string)
    const { data: docComments } = docIds.length > 0
      ? await supabase.from('document_comments').select('document_id, status').in('document_id', docIds).eq('status', 'open')
      : { data: [] }

    const clientStageStatuses: Record<string, string> = {}
    for (const s of clientStageRows ?? []) {
      clientStageStatuses[(s as any).stage] = (s as any).status
    }

    // Open comment count per document
    const openCommentsByDoc: Record<string, number> = {}
    for (const c of docComments ?? []) {
      openCommentsByDoc[(c as any).document_id] = (openCommentsByDoc[(c as any).document_id] ?? 0) + 1
    }
    const enrichedDocs = (docs ?? []).map((d: any) => ({
      ...d,
      open_comment_count: openCommentsByDoc[d.id] ?? 0,
    }))

    return (
      <ClientProjectView
        project={{ id, name: project.name, client: project.client, location: project.location, stage: project.stage, capacity_mw: project.capacity_mw }}
        stageStatuses={clientStageStatuses}
        documents={enrichedDocs}
        tests={(tests ?? []) as any}
        comments={comments ?? []}
        notifications={(notifications ?? []) as any}
        userId={user.id}
      />
    )
  }

  // ── Internal view ──────────────────────────────────────────────────────────
  const { data: userProfile } = await supabase.from('profiles').select('full_name, email').eq('id', user.id).single()
  const userName = userProfile?.full_name ?? userProfile?.email ?? 'Unknown'

  const [
    { data: projectComments },
    { data: projectStageRows },
    { data: assignedClients },
    { data: allClientProfiles },
    { data: linkedStandardRows },
    { data: linkedHsRows },
    { data: linkedLessonRows },
    { data: linkedOpRows },
    { data: allStandards },
    { data: allHs },
    { data: allLessons },
    { data: allOps },
    { data: projectItps },
    { data: constructionSite },
  ] = await Promise.all([
    supabase.from('client_comments')
      .select('*, comment_attachments(*)')
      .eq('project_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('project_stages')
      .select('*')
      .eq('project_id', id)
      .order('created_at'),
    supabase.from('project_clients')
      .select('id, user_id')
      .eq('project_id', id),
    supabase.from('profiles')
      .select('id, full_name, email')
      .eq('role', 'client'),
    supabase.from('project_standards').select('standard_id, standards(*, standard_clauses(*))').eq('project_id', id),
    supabase.from('project_hs_references').select('hs_id, hs_references(*)').eq('project_id', id),
    supabase.from('project_lessons_learned').select('lesson_id, lessons_learned(*)').eq('project_id', id),
    supabase.from('project_operator_rules').select('rule_id, operator_rules(*)').eq('project_id', id),
    supabase.from('standards').select('*, standard_clauses(*)').order('category').order('ref'),
    supabase.from('hs_references').select('*').order('category').order('ref'),
    supabase.from('lessons_learned').select('*').order('severity').order('category'),
    supabase.from('operator_rules').select('*').order('operator').order('category'),
    supabase.from('project_itps').select('*').eq('project_id', id).order('uploaded_at', { ascending: false }),
    supabase.from('construction_sites').select('id').eq('project_id', id).maybeSingle(),
  ])

  const linkedStandards = (linkedStandardRows ?? []).map((r: any) => r.standards).filter(Boolean)
  const linkedHs        = (linkedHsRows ?? []).map((r: any) => r.hs_references).filter(Boolean)
  const linkedLessons   = (linkedLessonRows ?? []).map((r: any) => r.lessons_learned).filter(Boolean)
  const linkedOps       = (linkedOpRows ?? []).map((r: any) => r.operator_rules).filter(Boolean)

  // Resolve display names for comment audit stamps
  const commentUserIds = new Set<string>()
  for (const c of projectComments ?? []) {
    if ((c as any).created_by)   commentUserIds.add((c as any).created_by)
    if ((c as any).responded_by) commentUserIds.add((c as any).responded_by)
  }
  const { data: commentProfiles } = commentUserIds.size > 0
    ? await supabase.from('profiles').select('id, full_name, email').in('id', [...commentUserIds])
    : { data: [] }
  const nameMap = Object.fromEntries((commentProfiles ?? []).map((p: any) => [p.id, p.full_name ?? p.email ?? 'Unknown']))

  const enrichedComments = (projectComments ?? []).map((c: any) => ({
    ...c,
    creator_name:   c.created_by   ? (nameMap[c.created_by]   ?? null) : null,
    responder_name: c.responded_by ? (nameMap[c.responded_by] ?? null) : null,
  }))

  // Seed project_stages if this project has none yet
  let projectStages = projectStageRows ?? []
  if (projectStages.length === 0) {
    const defaults = makeDefaultStages(id)
    const { data: seeded } = await supabase
      .from('project_stages')
      .insert(defaults)
      .select()
    projectStages = seeded ?? []
  }
  // Ensure all 6 stages present (handles projects created before migration)
  const stagesOrdered = STAGE_NAMES.map(name =>
    projectStages.find((s: any) => s.stage === name)
  ).filter(Boolean) as any[]

  const canEdit = ['admin', 'engineer'].includes(role)

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/projects" className="transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{project.name}</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {project.client} · {project.location}{project.capacity_mw ? ` · ${project.capacity_mw} MW` : ''}
          </p>
        </div>
        <Link href={`/projects/${id}/documents`}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border hover:opacity-80"
          style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
          <FileText size={13} /> Documents
        </Link>
        {role !== 'client' && (
          <Link href={`/projects/${id}/technical`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border hover:opacity-80"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
            <BookOpen size={13} /> Technical
          </Link>
        )}
        {role !== 'client' && (
          <Link href={`/projects/${id}/assurance`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border hover:opacity-80"
            style={{ color: '#22c55e', borderColor: '#22c55e44', background: '#22c55e0d' }}>
            <ShieldCheck size={13} /> Assurance
          </Link>
        )}
        <Link href={`/projects/${id}/edit`}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border hover:opacity-80"
          style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
          <Pencil size={13} /> Edit
        </Link>
      </div>

      {/* Stage tracker */}
      <div className="mb-6">
        <ProjectStageTracker
          stages={stagesOrdered}
          canEdit={canEdit}
          userId={user.id}
          userName={userName}
          projectId={id}
        />
      </div>


      {/* Feature panels */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {role !== 'client' && (
          <Link href={`/projects/${id}/assurance`}
            className="rounded-xl border p-5 flex flex-col gap-2 hover:opacity-80 col-span-2"
            style={{ background: '#0d2818', borderColor: '#22c55e44', minHeight: 80 }}>
            <div className="flex items-center gap-2">
              <ShieldCheck size={20} style={{ color: '#22c55e' }} />
              <p className="text-sm font-medium" style={{ color: '#22c55e' }}>Project Assurance</p>
            </div>
            <p className="text-xs" style={{ color: '#4ade8088' }}>ITP, Quality Check Sheets (QCS) and construction sign-off</p>
          </Link>
        )}
        <Link href={`/projects/${id}/documents`}
          className="rounded-xl border p-5 flex flex-col gap-2 hover:opacity-80"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', minHeight: 100 }}>
          <FileText size={20} style={{ color: 'var(--accent)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Document Library</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Upload and manage project documents</p>
        </Link>
        {role !== 'client' && (
          <Link href={`/projects/${id}/technical`}
            className="rounded-xl border p-5 flex flex-col gap-2 hover:opacity-80"
            style={{ background: 'var(--bg-surface)', borderColor: 'rgba(108,114,245,0.3)', minHeight: 100 }}>
            <BookOpen size={20} style={{ color: 'var(--accent)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Technical Information</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Manuals, studies &amp; received docs — AI compliance cross-check</p>
          </Link>
        )}
        <Link href={`/projects/${id}/procurement`}
          className="rounded-xl border p-5 flex flex-col gap-2 hover:opacity-80"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', minHeight: 100 }}>
          <ShoppingCart size={20} style={{ color: 'var(--accent)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Procurement</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Equipment register, quotes and lead times</p>
        </Link>
        <Link href={`/projects/${id}/tests`}
          className="rounded-xl border p-5 flex flex-col gap-2 hover:opacity-80"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', minHeight: 100 }}>
          <FlaskConical size={20} style={{ color: 'var(--accent)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Test Register</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Plate loads, GIs, cable tests, FAT &amp; SAT</p>
        </Link>
        {role !== 'operative' && (
          <Link href={`/comments?project=${id}`}
            className="rounded-xl border p-5 flex flex-col gap-2 hover:opacity-80"
            style={{ background: 'var(--bg-surface)', borderColor: (projectComments ?? []).some((c: any) => c.status === 'Open') ? 'rgba(251,146,60,0.5)' : 'var(--border)', minHeight: 100 }}>
            <div className="flex items-center gap-2">
              <MessageSquare size={20} style={{ color: (projectComments ?? []).some((c: any) => c.status === 'Open') ? '#fb923c' : 'var(--accent)' }} />
              {(projectComments ?? []).filter((c: any) => c.status === 'Open').length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: 'rgba(251,146,60,0.2)', color: '#fb923c' }}>
                  {(projectComments ?? []).filter((c: any) => c.status === 'Open').length} open
                </span>
              )}
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Comments</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {(projectComments ?? []).length === 0 ? 'Client comment & response log' : `${(projectComments ?? []).length} comment${(projectComments ?? []).length !== 1 ? 's' : ''} — view register`}
            </p>
          </Link>
        )}
        <Link href={`/projects/${id}/reviews`}
          className="rounded-xl border p-5 flex flex-col gap-2 hover:opacity-80"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', minHeight: 100 }}>
          <Sparkles size={20} style={{ color: 'var(--accent)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>AI Design Reviews</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>ER compliance, standards, constructability, procurement & clash</p>
        </Link>
        <Link href={`/projects/${id}/reviews`}
          className="rounded-xl border p-5 flex flex-col gap-2 hover:opacity-80"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', minHeight: 100 }}>
          <AlertTriangle size={20} style={{ color: '#fb923c' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Findings</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Review and sign off AI-raised findings</p>
        </Link>
        <Link href={`/projects/${id}/reviews#clash`}
          className="rounded-xl border p-5 flex flex-col gap-2 hover:opacity-80"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', minHeight: 100 }}>
          <Zap size={20} style={{ color: '#f472b6' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Clash Detection</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Physical & compliance clashes across all design documents</p>
        </Link>
        <Link href={`/projects/${id}/decision-log`}
          className="rounded-xl border p-5 flex flex-col gap-2 hover:opacity-80"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', minHeight: 100 }}>
          <BookMarked size={20} style={{ color: '#34d399' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Decision Log</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Full audit trail of all findings, decisions and actions</p>
        </Link>
        <Link href={`/projects/${id}/work-planner`}
          className="rounded-xl border p-5 flex flex-col gap-2 hover:opacity-80"
          style={{ background: 'var(--bg-surface)', borderColor: 'rgba(251,191,36,0.3)', minHeight: 100 }}>
          <TrendingUp size={20} style={{ color: '#fbbf24' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Work Planner</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>AI forecast — manpower, cost & long lead procurement</p>
        </Link>
      </div>

      {/* Client comments — visible to admin/PM/engineer, hidden from operative */}
      {role !== 'operative' && (projectComments ?? []).length > 0 && (
        <div className="mb-4">
          <InternalCommentPanel
            projectId={id}
            userId={user.id}
            initialComments={enrichedComments}
          />
        </div>
      )}

      {/* Client access — admin/PM only */}
      {['admin', 'project_manager'].includes(role) && (
        <div className="mb-4">
          <ClientAccessPanel
            projectId={id}
            initialAssigned={(assignedClients ?? []).map((a: any) => {
              const profile = (allClientProfiles ?? []).find((p: any) => p.id === a.user_id)
              return {
                id: a.id,
                user_id: a.user_id,
                full_name: profile?.full_name ?? null,
                email: profile?.email ?? '',
              }
            })}
            availableClients={(allClientProfiles ?? []).map((p: any) => ({
              id: p.id,
              full_name: p.full_name ?? null,
              email: p.email ?? '',
            }))}
          />
        </div>
      )}

      {/* ER */}
      <div className="mb-4">
        <ProjectER
          projectId={id}
          erStoragePath={project.er_storage_path ?? null}
          erFileName={project.er_file_name ?? null}
          erMissingStandards={project.er_missing_standards ?? []}
          erAnalysedAt={project.er_analysed_at ?? null}
        />
      </div>

      <ProjectReferences
        projectId={id}
        linkedStandards={linkedStandards}
        linkedHs={linkedHs}
        linkedLessons={linkedLessons}
        linkedOps={linkedOps}
        allStandards={allStandards ?? []}
        allHs={allHs ?? []}
        allLessons={allLessons ?? []}
        allOps={allOps ?? []}
      />
    </div>
  )
}
