import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

const SEVERITY_CLASS: Record<string, string> = {
  critical: 'badge-critical',
  major: 'badge-major',
  minor: 'badge-minor',
  observation: 'badge-neutral',
}

export default async function DefectsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: defects } = await supabase
    .from('defects')
    .select('*')
    .eq('vessel_id', id)
    .order('reported_date', { ascending: false })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Defects & NCRs</h2>
        <Link href={`/vessels/${id}/defects/new`}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white"
              style={{ background: 'var(--accent)' }}>
          + Log Defect
        </Link>
      </div>

      {(!defects || defects.length === 0) && (
        <div className="text-center py-16">
          <AlertTriangle size={36} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>No defects logged</p>
        </div>
      )}

      {defects && defects.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-elevated)' }}>
                {['Ref', 'Title', 'Type', 'Severity', 'Source', 'Reported', 'Status'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium"
                      style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {defects.map((d, i) => (
                <tr key={d.id}
                    style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)' }}>
                  <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                    {d.ref_no}
                  </td>
                  <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                    {d.title}
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{d.type}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${SEVERITY_CLASS[d.severity] ?? 'badge-neutral'}`}>
                      {d.severity}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{d.source ?? '—'}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{d.reported_date}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      d.status === 'open' ? 'badge-critical' :
                      d.status === 'in_progress' ? 'badge-minor' :
                      d.status === 'closed' ? 'badge-success' : 'badge-neutral'
                    }`}>{d.status.replace('_', ' ')}</span>
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
