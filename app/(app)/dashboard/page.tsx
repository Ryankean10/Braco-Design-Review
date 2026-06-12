import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FolderOpen, Plus, MessageSquare } from 'lucide-react'
import type { Stage } from '@/lib/types'
import ClientDashboard from '@/components/ClientDashboard'

const STAGE_ORDER: Stage[] = [
  'Feasibility', 'Design', 'Procure', 'Build & Install', 'Test & Commission', 'Energise & Handover'
]

function stageColour(stage: Stage) {
  const map: Record<Stage, string> = {
    'Feasibility':         '#4b5563',
    'Design':              '#2563eb',
    'Procure':             '#7c3aed',
    'Build & Install':     '#d97706',
    'Test & Commission':   '#dc2626',
    'Energise & Handover': '#16a34a',
  }
  return map[stage] ?? '#4b5563'
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role, full_name, email').eq('id', user.id).single()
  const role = profile?.role ?? 'engineer'

  // ── Client dashboard ───────────────────────────────────────────────────────
  if (role === 'client') {
    const { data: projects } = await supabase
      .from('projects')
      .select('id, name, client, location, stage, capacity_mw')
      .order('updated_at', { ascending: false })

    const projectIds = (projects ?? []).map(p => p.id)

    const [{ data: docs }, { data: tests }, { data: comments }] = await Promise.all([
      supabase.from('documents').select('id, project_id').eq('for_client_review', true).in('project_id', projectIds),
      supabase.from('test_register').select('id, project_id, status').in('project_id', projectIds),
      supabase.from('client_comments').select('id, project_id, status, created_by').in('project_id', projectIds),
    ])

    const enriched = (projects ?? []).map(p => ({
      ...p,
      docCount:               (docs ?? []).filter(d => d.project_id === p.id).length,
      testPassCount:          (tests ?? []).filter(t => t.project_id === p.id && t.status === 'Pass').length,
      testTotalCount:         (tests ?? []).filter(t => t.project_id === p.id).length,
      openComments:           (comments ?? []).filter(c => c.project_id === p.id && c.status === 'Open' && c.created_by === user.id).length,
      awaitingResponseCount:  (comments ?? []).filter(c => c.project_id === p.id && c.status === 'Responded' && c.created_by === user.id).length,
    }))

    return <ClientDashboard profile={{ full_name: profile?.full_name ?? null, email: profile?.email ?? user.email ?? '' }} projects={enriched} />
  }

  // ── Internal dashboard ─────────────────────────────────────────────────────
  const [{ data: projects }, { data: openComments }] = await Promise.all([
    supabase.from('projects').select('*').order('updated_at', { ascending: false }),
    // Show open client comments to all except operative
    role !== 'operative'
      ? supabase.from('client_comments').select('id, project_id, subject_label, created_at, status').eq('status', 'Open').order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  const byStage = STAGE_ORDER.map(stage => ({
    stage,
    count: projects?.filter(p => p.stage === stage).length ?? 0,
  }))

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>BESS project review overview</p>
        </div>
        {['admin', 'project_manager', 'engineer'].includes(role) && (
          <Link href="/projects/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90"
            style={{ background: 'var(--accent)' }}>
            <Plus size={15} /> New project
          </Link>
        )}
      </div>

      {/* Client comment flag — admin/PM/engineer only */}
      {role !== 'operative' && (openComments ?? []).length > 0 && (
        <div className="rounded-xl border p-4" style={{ background: 'rgba(251,146,60,0.08)', borderColor: 'rgba(251,146,60,0.3)' }}>
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare size={14} style={{ color: '#fb923c' }} />
            <p className="text-sm font-semibold" style={{ color: '#fb923c' }}>
              {(openComments ?? []).length} open client comment{(openComments ?? []).length !== 1 ? 's' : ''} require a response
            </p>
          </div>
          <div className="space-y-1">
            {(openComments ?? []).slice(0, 5).map((c: any) => (
              <Link key={c.id} href={`/comments?project=${c.project_id}`}
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:opacity-80"
                style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.15)' }}>
                <span className="text-xs truncate" style={{ color: '#fdba74' }}>
                  {c.subject_label ?? 'General comment'}
                </span>
                <span className="text-[10px] flex-shrink-0 ml-2" style={{ color: '#fb923c' }}>
                  {new Date(c.created_at).toLocaleDateString('en-GB')}
                </span>
              </Link>
            ))}
            {(openComments ?? []).length > 5 && (
              <p className="text-xs px-3" style={{ color: '#fb923c' }}>+{(openComments ?? []).length - 5} more</p>
            )}
          </div>
        </div>
      )}

      {/* Stage summary */}
      <div className="grid grid-cols-3 gap-4">
        {byStage.map(({ stage, count }) => (
          <div key={stage} className="rounded-xl p-4 border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{stage}</p>
            <p className="text-3xl font-bold" style={{ color: stageColour(stage) }}>{count}</p>
          </div>
        ))}
      </div>

      {/* Recent projects */}
      <div className="rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Projects</h2>
          <Link href="/projects" className="text-xs hover:underline" style={{ color: 'var(--accent)' }}>View all</Link>
        </div>
        {!projects?.length ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <FolderOpen size={32} style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No projects yet</p>
            <Link href="/projects/new" className="text-sm px-4 py-2 rounded-lg text-white" style={{ background: 'var(--accent)' }}>
              Create your first project
            </Link>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {projects.slice(0, 8).map(project => (
              <Link key={project.id} href={`/projects/${project.id}`}
                className="flex items-center justify-between px-6 py-3.5 hover:opacity-80 transition-opacity">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{project.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {project.client} — {project.location}{project.capacity_mw ? ` · ${project.capacity_mw} MW` : ''}
                  </p>
                </div>
                <span className="chip-stage text-xs px-2 py-0.5 rounded-full font-medium">{project.stage}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
