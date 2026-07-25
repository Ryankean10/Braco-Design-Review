import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Wrench } from 'lucide-react'

export default async function WorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: wo }, { data: parts }] = await Promise.all([
    supabase.from('work_orders').select('*, vessels(name)').eq('id', id).single(),
    supabase.from('work_order_parts').select('*').eq('work_order_id', id),
  ])

  if (!wo) notFound()

  const partsCost = (parts ?? []).reduce((sum, p) => sum + (p.unit_cost ?? 0) * p.quantity, 0)
  const totalCost = (wo.labor_cost ?? 0) + partsCost

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        <Link href="/work-orders" style={{ color: 'var(--accent)' }}>Work Orders</Link>
        <span>/</span>
        <span>{wo.wo_number}</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{wo.title}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {wo.wo_number} · {(wo.vessels as any)?.name ?? 'Unknown vessel'}
          </p>
        </div>
        <span className={`text-sm px-2.5 py-1 rounded-lg font-medium ${
          wo.status === 'completed' ? 'badge-success' :
          wo.status === 'in_progress' ? 'badge-minor' :
          wo.status === 'open' ? 'badge-info' : 'badge-neutral'
        }`}>{wo.status.replace('_', ' ')}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          {wo.description && (
            <div className="rounded-xl p-4"
                 style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <h3 className="text-xs font-semibold mb-2 uppercase tracking-widest"
                  style={{ color: 'var(--text-muted)' }}>Description</h3>
              <p className="text-sm" style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{wo.description}</p>
            </div>
          )}

          {/* Parts */}
          <div className="rounded-xl p-4"
               style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <h3 className="text-xs font-semibold mb-3 uppercase tracking-widest"
                style={{ color: 'var(--text-muted)' }}>Parts & Materials</h3>
            {(!parts || parts.length === 0) ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No parts recorded</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {['Description', 'Qty', 'Unit Cost', 'Total'].map(h => (
                      <th key={h} className="pb-2 text-left text-xs font-medium"
                          style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parts.map(p => (
                    <tr key={p.id}>
                      <td className="py-1.5" style={{ color: 'var(--text-primary)' }}>{p.description}</td>
                      <td className="py-1.5" style={{ color: 'var(--text-muted)' }}>{p.quantity}</td>
                      <td className="py-1.5" style={{ color: 'var(--text-muted)' }}>
                        {p.unit_cost ? `$${p.unit_cost.toFixed(2)}` : '—'}
                      </td>
                      <td className="py-1.5" style={{ color: 'var(--text-primary)' }}>
                        {p.unit_cost ? `$${(p.unit_cost * p.quantity).toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {wo.remarks && (
            <div className="rounded-xl p-4"
                 style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <h3 className="text-xs font-semibold mb-2 uppercase tracking-widest"
                  style={{ color: 'var(--text-muted)' }}>Remarks</h3>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{wo.remarks}</p>
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          <div className="rounded-xl p-4"
               style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <h3 className="text-xs font-semibold mb-3 uppercase tracking-widest"
                style={{ color: 'var(--text-muted)' }}>Details</h3>
            <dl className="space-y-2 text-sm">
              {[
                ['Type', wo.type],
                ['Planned', wo.planned_date ?? '—'],
                ['Started', wo.started_at ? new Date(wo.started_at).toLocaleDateString() : '—'],
                ['Completed', wo.completed_at ? new Date(wo.completed_at).toLocaleDateString() : '—'],
                ['Actual Hours', wo.actual_hours ?? '—'],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between">
                  <dt style={{ color: 'var(--text-muted)' }}>{k}</dt>
                  <dd style={{ color: 'var(--text-primary)' }}>{String(v)}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-xl p-4"
               style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <h3 className="text-xs font-semibold mb-3 uppercase tracking-widest"
                style={{ color: 'var(--text-muted)' }}>Cost Summary</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt style={{ color: 'var(--text-muted)' }}>Labour</dt>
                <dd style={{ color: 'var(--text-primary)' }}>${(wo.labor_cost ?? 0).toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt style={{ color: 'var(--text-muted)' }}>Parts</dt>
                <dd style={{ color: 'var(--text-primary)' }}>${partsCost.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between pt-2 font-semibold"
                   style={{ borderTop: '1px solid var(--border)' }}>
                <dt style={{ color: 'var(--text-primary)' }}>Total</dt>
                <dd style={{ color: 'var(--accent)' }}>${totalCost.toFixed(2)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
