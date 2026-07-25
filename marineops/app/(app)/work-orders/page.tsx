import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Wrench } from 'lucide-react'

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge-neutral',
  open: 'badge-info',
  in_progress: 'badge-minor',
  completed: 'badge-success',
  cancelled: 'badge-neutral',
}

export default async function WorkOrdersPage() {
  const supabase = await createClient()

  const { data: wos } = await supabase
    .from('work_orders')
    .select('*, vessels(name)')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Work Orders</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{wos?.length ?? 0} work orders</p>
        </div>
        <Link href="/work-orders/new"
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: 'var(--accent)' }}>
          + New Work Order
        </Link>
      </div>

      {(!wos || wos.length === 0) && (
        <div className="text-center py-16">
          <Wrench size={40} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>No work orders yet</p>
        </div>
      )}

      {wos && wos.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-elevated)' }}>
                {['WO Number', 'Title', 'Vessel', 'Type', 'Planned Date', 'Status'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium"
                      style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {wos.map((wo, i) => (
                <tr key={wo.id}
                    style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)' }}>
                  <td className="px-4 py-2.5">
                    <Link href={`/work-orders/${wo.id}`}
                          className="text-xs font-mono hover:underline"
                          style={{ color: 'var(--accent)' }}>
                      {wo.wo_number}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                    {wo.title}
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {(wo.vessels as any)?.name ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{wo.type}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {wo.planned_date ?? '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_BADGE[wo.status] ?? 'badge-neutral'}`}>
                      {wo.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
