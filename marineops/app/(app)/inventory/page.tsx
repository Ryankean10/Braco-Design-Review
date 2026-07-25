import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Package } from 'lucide-react'

export default async function InventoryPage() {
  const supabase = await createClient()

  const { data: items } = await supabase
    .from('inventory')
    .select('*, vessels(name)')
    .order('name')

  const lowItems = (items ?? []).filter(i => i.quantity <= i.min_quantity)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Inventory</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Fleet-wide stock levels</p>
        </div>
      </div>

      {lowItems.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: '#3f121220', border: '1px solid var(--critical)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--critical)' }}>
            {lowItems.length} item{lowItems.length !== 1 ? 's' : ''} below minimum stock level
          </p>
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--bg-elevated)' }}>
              {['Vessel', 'Part No', 'Name', 'Category', 'Qty', 'Min', 'Unit Cost', 'Flags'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium"
                    style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((item, i) => {
              const low = item.quantity <= item.min_quantity
              return (
                <tr key={item.id}
                    style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)' }}>
                  <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <Link href={`/vessels/${item.vessel_id}/inventory`} style={{ color: 'var(--accent)' }}>
                      {(item.vessels as any)?.name ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{item.part_no ?? '—'}</td>
                  <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>{item.name}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{item.category ?? '—'}</td>
                  <td className="px-4 py-2.5 font-semibold"
                      style={{ color: low ? 'var(--critical)' : 'var(--text-primary)' }}>
                    {item.quantity}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--text-muted)' }}>{item.min_quantity}</td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--text-muted)' }}>
                    {item.unit_cost ? `$${item.unit_cost.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      {item.critical_spare && <span className="text-xs px-1.5 py-0.5 rounded badge-critical">CRIT</span>}
                      {item.class_required && <span className="text-xs px-1.5 py-0.5 rounded badge-info">CLASS</span>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
