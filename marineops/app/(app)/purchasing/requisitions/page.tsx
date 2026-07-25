import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'badge-critical',
  normal: 'badge-info',
  planned: 'badge-neutral',
}

export default async function RequisitionsPage() {
  const supabase = await createClient()

  const { data: reqs } = await supabase
    .from('requisitions')
    .select('*, vessels(name)')
    .order('created_at', { ascending: false })

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Requisitions</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{reqs?.length ?? 0} requisitions</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/purchasing"
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            Purchase Orders
          </Link>
          <Link href="/purchasing/requisitions/new"
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'var(--accent)' }}>
            + New Requisition
          </Link>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--bg-elevated)' }}>
              {['Ref', 'Title', 'Vessel', 'Priority', 'Required By', 'Status'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium"
                    style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(reqs ?? []).map((req, i) => (
              <tr key={req.id}
                  style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)' }}>
                <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--accent)' }}>{req.req_number}</td>
                <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>{req.title}</td>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {(req.vessels as any)?.name ?? '—'}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${PRIORITY_COLOR[req.priority] ?? 'badge-neutral'}`}>
                    {req.priority}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {req.required_by ?? '—'}
                </td>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {req.status.replace('_', ' ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
