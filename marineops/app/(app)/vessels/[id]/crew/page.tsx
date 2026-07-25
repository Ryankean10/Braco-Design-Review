import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Users } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  onboard: 'var(--success)',
  signed_off: 'var(--text-muted)',
  shore_based: 'var(--minor)',
}

export default async function CrewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: crew } = await supabase
    .from('crew')
    .select('*')
    .eq('vessel_id', id)
    .order('rank')
    .order('last_name')

  const onboard = (crew ?? []).filter(c => c.status === 'onboard').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Crew Roster</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {onboard} onboard · {crew?.length ?? 0} total
          </p>
        </div>
        <Link href={`/vessels/${id}/crew/new`}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white"
              style={{ background: 'var(--accent)' }}>
          + Add Crew
        </Link>
      </div>

      {(!crew || crew.length === 0) && (
        <div className="text-center py-16">
          <Users size={36} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>No crew registered</p>
        </div>
      )}

      {crew && crew.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-elevated)' }}>
                {['Name', 'Rank', 'Nationality', 'Passport No', 'Sign On', 'Sign Off', 'Status'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium"
                      style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {crew.map((c, i) => (
                <tr key={c.id}
                    style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)' }}>
                  <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                    {c.first_name} {c.last_name}
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{c.rank}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{c.nationality ?? '—'}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{c.passport_no ?? '—'}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{c.sign_on_date ?? '—'}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{c.sign_off_date ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs font-medium" style={{ color: STATUS_COLORS[c.status] ?? 'var(--text-muted)' }}>
                      {c.status.replace('_', ' ')}
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
