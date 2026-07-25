import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Wrench } from 'lucide-react'

function dueStatus(nextDue: string | null, today: string) {
  if (!nextDue) return { label: 'No due date', color: 'var(--text-muted)' }
  if (nextDue < today) return { label: 'OVERDUE', color: 'var(--critical)' }
  const days = Math.ceil((new Date(nextDue).getTime() - new Date(today).getTime()) / 86400000)
  if (days <= 30) return { label: `Due in ${days}d`, color: 'var(--minor)' }
  return { label: `Due ${nextDue}`, color: 'var(--success)' }
}

export default async function MaintenancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

  const { data: jobs } = await supabase
    .from('maintenance_jobs')
    .select('*')
    .eq('vessel_id', id)
    .eq('status', 'active')
    .order('next_due_date', { ascending: true, nullsFirst: false })

  const overdue = (jobs ?? []).filter(j => j.next_due_date && j.next_due_date < today)
  const dueSoon = (jobs ?? []).filter(j => j.next_due_date && j.next_due_date >= today && j.next_due_date <= in30)
  const scheduled = (jobs ?? []).filter(j => !j.next_due_date || j.next_due_date > in30)

  function JobGroup({ title, items, accent }: { title: string; items: typeof jobs; accent: string }) {
    if (!items || items.length === 0) return null
    return (
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: accent }}>
          {title} ({items.length})
        </h3>
        <div className="space-y-2">
          {items.map(job => {
            const due = dueStatus(job.next_due_date, today)
            return (
              <div key={job.id} className="rounded-xl p-4"
                   style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                      {job.title}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {job.category} · {job.interval_type === 'calendar'
                        ? `Every ${job.interval_days}d`
                        : job.interval_type === 'hours'
                        ? `Every ${job.interval_hours}h`
                        : `${job.interval_days}d / ${job.interval_hours}h`
                      }
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {job.class_required && (
                      <span className="text-xs px-1.5 py-0.5 rounded badge-info">CLASS</span>
                    )}
                    <span className="text-xs font-semibold" style={{ color: due.color }}>{due.label}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Planned Maintenance
        </h2>
        <Link href={`/vessels/${id}/maintenance/new`}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white"
              style={{ background: 'var(--accent)' }}>
          + New Job
        </Link>
      </div>

      {(!jobs || jobs.length === 0) && (
        <div className="text-center py-16">
          <Wrench size={36} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>No maintenance jobs defined</p>
        </div>
      )}

      <JobGroup title="Overdue" items={overdue} accent="var(--critical)" />
      <JobGroup title="Due within 30 days" items={dueSoon} accent="var(--minor)" />
      <JobGroup title="Scheduled" items={scheduled} accent="var(--text-muted)" />
    </div>
  )
}
