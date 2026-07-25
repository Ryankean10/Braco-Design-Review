import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const STATUS_COLOR: Record<string, string> = {
  onboard: 'var(--success)',
  signed_off: 'var(--text-muted)',
  shore_based: 'var(--minor)',
}

export default async function FleetCrewPage() {
  const supabase = await createClient()

  const { data: crew } = await supabase
    .from('crew')
    .select('*, vessels(id,name)')
    .order('last_name')

  const onboard = (crew ?? []).filter(c => c.status === 'onboard').length

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Crew</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {onboard} onboard · {crew?.length ?? 0} total fleet crew
        </p>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--bg-elevated)' }}>
              {['Name', 'Rank', 'Vessel', 'Nationality', 'Sign On', 'Sign Off', 'Status'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium"
                    style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(crew ?? []).map((c, i) => (
              <tr key={c.id}
                  style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)' }}>
                <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                  {c.first_name} {c.last_name}
                </td>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{c.rank}</td>
                <td className="px-4 py-2.5 text-xs">
                  <Link href={`/vessels/${(c.vessels as any)?.id}/crew`} style={{ color: 'var(--accent)' }}>
                    {(c.vessels as any)?.name ?? '—'}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{c.nationality ?? '—'}</td>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{c.sign_on_date ?? '—'}</td>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{c.sign_off_date ?? '—'}</td>
                <td className="px-4 py-2.5 text-xs font-medium" style={{ color: STATUS_COLOR[c.status] ?? 'var(--text-muted)' }}>
                  {c.status.replace('_', ' ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
