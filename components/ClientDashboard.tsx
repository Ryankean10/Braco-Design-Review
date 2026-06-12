'use client'

import Link from 'next/link'
import { CheckCircle2, Clock, AlertCircle, MessageSquare, FileText, FlaskConical } from 'lucide-react'
import type { ClientComment } from '@/components/ClientCommentThread'

type Stage = string

interface ProjectSummary {
  id: string
  name: string
  client: string
  location: string
  stage: Stage
  activeStages: string[]
  capacity_mw: number | null
  docCount: number
  testPassCount: number
  testTotalCount: number
  openComments: number
  awaitingResponseCount: number
}

interface Props {
  profile: { full_name: string | null; email: string }
  projects: ProjectSummary[]
}

const STAGE_COLORS: Record<string, string> = {
  'Feasibility':          '#94a3b8',
  'Design':               '#60a5fa',
  'Procure':              '#c084fc',
  'Build & Install':      '#fb923c',
  'Test & Commission':    '#facc15',
  'Energise & Handover':  '#4ade80',
}

export default function ClientDashboard({ profile, projects }: Props) {
  const totalOpenComments = projects.reduce((sum, p) => sum + p.openComments, 0)
  const totalAwaiting = projects.reduce((sum, p) => sum + p.awaitingResponseCount, 0)

  return (
    <div className="min-h-screen p-6 space-y-6 max-w-5xl mx-auto" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Welcome{profile.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Your project overview</p>
      </div>

      {/* Notification banners */}
      {totalAwaiting > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)' }}>
          <MessageSquare size={14} style={{ color: '#60a5fa' }} />
          <p className="text-sm" style={{ color: '#93c5fd' }}>
            <strong>{totalAwaiting}</strong> comment{totalAwaiting !== 1 ? 's' : ''} have received a response — tap a project to review
          </p>
        </div>
      )}
      {totalOpenComments > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.3)' }}>
          <Clock size={14} style={{ color: '#fb923c' }} />
          <p className="text-sm" style={{ color: '#fdba74' }}>
            <strong>{totalOpenComments}</strong> open comment{totalOpenComments !== 1 ? 's' : ''} awaiting response from the project team
          </p>
        </div>
      )}

      {/* Project cards */}
      {projects.length === 0 ? (
        <div className="text-center py-20 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No projects assigned to your account yet</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map(p => (
            <Link key={p.id} href={`/projects/${p.id}`}
              className="rounded-xl border p-5 hover:opacity-90 transition-opacity block"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{p.location}{p.capacity_mw ? ` · ${p.capacity_mw} MW` : ''}</p>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-end flex-shrink-0">
                  {(p.activeStages.length > 0 ? p.activeStages : [p.stage]).map((s: string) => (
                    <span key={s} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: `${STAGE_COLORS[s] ?? '#94a3b8'}20`, color: STAGE_COLORS[s] ?? '#94a3b8' }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Stats row */}
              <div className="flex flex-wrap gap-4 mt-4 text-xs">
                {p.docCount > 0 && (
                  <div className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                    <FileText size={12} style={{ color: 'var(--accent)' }} />
                    {p.docCount} doc{p.docCount !== 1 ? 's' : ''} for review
                  </div>
                )}
                {p.testTotalCount > 0 && (
                  <div className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                    <FlaskConical size={12} style={{ color: '#4ade80' }} />
                    {p.testPassCount}/{p.testTotalCount} tests passed
                  </div>
                )}
                {p.openComments > 0 && (
                  <div className="flex items-center gap-1.5" style={{ color: '#fb923c' }}>
                    <Clock size={12} />
                    {p.openComments} awaiting response
                  </div>
                )}
                {p.awaitingResponseCount > 0 && (
                  <div className="flex items-center gap-1.5" style={{ color: '#60a5fa' }}>
                    <MessageSquare size={12} />
                    {p.awaitingResponseCount} response{p.awaitingResponseCount !== 1 ? 's' : ''} to review
                  </div>
                )}
                {p.openComments === 0 && p.awaitingResponseCount === 0 && p.docCount === 0 && (
                  <div className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                    <CheckCircle2 size={12} style={{ color: '#4ade80' }} />
                    No action required
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
