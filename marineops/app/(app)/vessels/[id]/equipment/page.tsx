import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Settings } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  operational: 'var(--success)',
  degraded: 'var(--minor)',
  failed: 'var(--critical)',
  decommissioned: 'var(--text-muted)',
}

export default async function EquipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: equipment } = await supabase
    .from('equipment')
    .select('*')
    .eq('vessel_id', id)
    .order('category')
    .order('name')

  const grouped = (equipment ?? []).reduce<Record<string, typeof equipment>>((acc, eq) => {
    const cat = eq.category
    if (!acc[cat]) acc[cat] = []
    acc[cat]!.push(eq)
    return acc
  }, {})

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Equipment Registry</h2>
        <Link href={`/vessels/${id}/equipment/new`}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white"
              style={{ background: 'var(--accent)' }}>
          + Add Equipment
        </Link>
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="text-center py-16">
          <Settings size={36} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>No equipment registered</p>
        </div>
      )}

      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <h3 className="text-xs font-semibold uppercase tracking-widest mb-2"
              style={{ color: 'var(--text-muted)' }}>
            {category}
          </h3>
          <div className="rounded-xl overflow-hidden"
               style={{ border: '1px solid var(--border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--bg-elevated)' }}>
                  {['Name', 'Maker / Model', 'Serial No', 'Running Hours', 'Status', 'Flags'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium"
                        style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(items ?? []).map((eq, i) => (
                  <tr key={eq.id}
                      style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)' }}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                      {eq.name}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-muted)' }}>
                      {[eq.maker, eq.model].filter(Boolean).join(' / ') || '—'}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-muted)' }}>
                      {eq.serial_no ?? '—'}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-primary)' }}>
                      {eq.running_hours ? eq.running_hours.toLocaleString() + ' h' : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-medium" style={{ color: STATUS_COLORS[eq.status] ?? 'var(--text-muted)' }}>
                        {eq.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1.5">
                        {eq.critical && (
                          <span className="text-xs px-1.5 py-0.5 rounded badge-critical">CRITICAL</span>
                        )}
                        {eq.class_item && (
                          <span className="text-xs px-1.5 py-0.5 rounded badge-info">CLASS</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
