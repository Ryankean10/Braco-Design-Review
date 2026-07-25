import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

const SEVERITY_CLASS: Record<string, string> = {
  critical: 'badge-critical', major: 'badge-major',
  minor: 'badge-minor', observation: 'badge-neutral',
}

export default async function DefectsPage() {
  const supabase = await createClient()

  const { data: defects } = await supabase
    .from('defects')
    .select('*, vessels(id,name)')
    .order('reported_date', { ascending: false })

  const critical = (defects ?? []).filter(d => d.severity === 'critical' && d.status === 'open')

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Defects & NCRs</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Fleet-wide defect register</p>
      </div>

      {critical.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: '#3f121220', border: '1px solid var(--critical)' }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} style={{ color: 'var(--critical)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--critical)' }}>
              {critical.length} critical open defect{critical.length !== 1 ? 's' : ''}
            </p>
          </div>
          <ul className="space-y-1">
            {critical.map(d => (
              <li key={d.id} className="text-xs" style={{ color: 'var(--critical)' }}>
                {(d.vessels as any)?.name}: {d.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--bg-elevated)' }}>
              {['Ref', 'Vessel', 'Title', 'Type', 'Severity', 'Reported', 'Status'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium"
                    style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(defects ?? []).map((d, i) => (
              <tr key={d.id}
                  style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)' }}>
                <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{d.ref_no}</td>
                <td className="px-4 py-2.5 text-xs">
                  <Link href={`/vessels/${(d.vessels as any)?.id}/defects`} style={{ color: 'var(--accent)' }}>
                    {(d.vessels as any)?.name ?? '—'}
                  </Link>
                </td>
                <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>{d.title}</td>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{d.type}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${SEVERITY_CLASS[d.severity] ?? 'badge-neutral'}`}>
                    {d.severity}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{d.reported_date}</td>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {d.status.replace('_', ' ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
