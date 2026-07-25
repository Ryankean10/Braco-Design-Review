import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Package } from 'lucide-react'

export default async function VesselInventoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: items } = await supabase
    .from('inventory')
    .select('*')
    .eq('vessel_id', id)
    .order('name')

  const lowCount = (items ?? []).filter(i => i.quantity <= i.min_quantity).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Inventory</h2>
          {lowCount > 0 && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--critical)' }}>
              {lowCount} item{lowCount !== 1 ? 's' : ''} below minimum stock level
            </p>
          )}
        </div>
        <Link href={`/vessels/${id}/inventory/new`}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white"
              style={{ background: 'var(--accent)' }}>
          + Add Item
        </Link>
      </div>

      {(!items || items.length === 0) && (
        <div className="text-center py-16">
          <Package size={36} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>No inventory items</p>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-elevated)' }}>
                {['Part No', 'Name', 'Location', 'Unit', 'Qty', 'Min', 'Unit Cost', 'Flags'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium"
                      style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const low = item.quantity <= item.min_quantity
                return (
                  <tr key={item.id}
                      style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)' }}>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {item.part_no ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                      {item.name}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {item.location_on_vessel ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {item.unit}
                    </td>
                    <td className="px-4 py-2.5 font-semibold"
                        style={{ color: low ? 'var(--critical)' : 'var(--text-primary)' }}>
                      {item.quantity}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-muted)' }}>
                      {item.min_quantity}
                    </td>
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
      )}
    </div>
  )
}
