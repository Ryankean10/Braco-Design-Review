import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Ship } from 'lucide-react'
import StatusBadge from '@/components/StatusBadge'
import type { TrafficLight } from '@/lib/types'

function vesselStatusLight(status: string): TrafficLight {
  if (status === 'active') return 'green'
  if (status === 'refit') return 'amber'
  return 'neutral'
}

export default async function VesselsPage() {
  const supabase = await createClient()
  const { data: vessels } = await supabase
    .from('vessels')
    .select('*')
    .order('name')

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Vessels</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {vessels?.length ?? 0} vessel{(vessels?.length ?? 0) !== 1 ? 's' : ''} in fleet
          </p>
        </div>
        <Link href="/vessels/new"
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: 'var(--accent)' }}>
          + Add Vessel
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {(vessels ?? []).map(v => (
          <Link key={v.id} href={`/vessels/${v.id}`}
                className="rounded-xl p-5 block hover:ring-1 transition-all"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                     style={{ background: 'var(--accent)18' }}>
                  <Ship size={18} style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{v.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{v.vessel_type}</p>
                </div>
              </div>
              <StatusBadge status={vesselStatusLight(v.status)} label={v.status} />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {[
                ['Flag', v.flag],
                ['IMO', v.imo_number ?? '—'],
                ['Class', v.class_society ?? '—'],
                ['GT', v.gt ?? '—'],
                ['Year', v.year_built ?? '—'],
                ['LOA', v.loa_m ? `${v.loa_m} m` : '—'],
              ].map(([k, val]) => (
                <div key={k} className="flex gap-1">
                  <span style={{ color: 'var(--text-muted)' }}>{k}:</span>
                  <span style={{ color: 'var(--text-primary)' }}>{String(val)}</span>
                </div>
              ))}
            </div>
            {v.owner && (
              <p className="text-xs mt-2 pt-2" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                Owner: {v.owner}
              </p>
            )}
          </Link>
        ))}
      </div>

      {(!vessels || vessels.length === 0) && (
        <div className="text-center py-16">
          <Ship size={40} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>No vessels yet</p>
          <p className="text-sm mt-1 mb-4" style={{ color: 'var(--text-muted)' }}>Add your first vessel to get started</p>
          <Link href="/vessels/new" className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'var(--accent)' }}>Add Vessel</Link>
        </div>
      )}
    </div>
  )
}
