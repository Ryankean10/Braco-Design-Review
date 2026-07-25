import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge-neutral', sent: 'badge-info', confirmed: 'badge-minor',
  partially_received: 'badge-minor', received: 'badge-success',
  invoiced: 'badge-success', cancelled: 'badge-neutral',
}

export default async function PurchasingPage() {
  const supabase = await createClient()

  const { data: pos } = await supabase
    .from('purchase_orders')
    .select('*, vessels(name), suppliers(name)')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Purchase Orders</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{pos?.length ?? 0} orders</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/purchasing/requisitions"
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            Requisitions
          </Link>
          <Link href="/purchasing/new"
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'var(--accent)' }}>
            + New PO
          </Link>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--bg-elevated)' }}>
              {['PO Number', 'Vessel', 'Supplier', 'Issue Date', 'Expected', 'Amount', 'Status'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium"
                    style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(pos ?? []).map((po, i) => (
              <tr key={po.id}
                  style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)' }}>
                <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--accent)' }}>{po.po_number}</td>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {(po.vessels as any)?.name ?? '—'}
                </td>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {(po.suppliers as any)?.name ?? '—'}
                </td>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{po.issue_date}</td>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {po.expected_delivery ?? '—'}
                </td>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-primary)' }}>
                  {po.total_amount ? `${po.currency} ${Number(po.total_amount).toLocaleString()}` : '—'}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_BADGE[po.status] ?? 'badge-neutral'}`}>
                    {po.status.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
