import { createClient } from '@/lib/supabase/server'

const ACTION_BADGE: Record<string, string> = {
  insert: 'badge-success',
  update: 'badge-info',
  delete: 'badge-critical',
}

export default async function AuditLogPage() {
  const supabase = await createClient()

  const { data: logs } = await supabase
    .from('audit_log')
    .select('*, profiles(full_name,email)')
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Audit Log</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Last {logs?.length ?? 0} changes — immutable record
        </p>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--bg-elevated)' }}>
              {['Timestamp', 'User', 'Action', 'Table', 'Record ID'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium"
                    style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(logs ?? []).map((log, i) => (
              <tr key={log.id}
                  style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)' }}>
                <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-primary)' }}>
                  {(log.profiles as any)?.full_name ?? (log.profiles as any)?.email ?? 'System'}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${ACTION_BADGE[log.action] ?? 'badge-neutral'}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                  {log.table_name}
                </td>
                <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                  {log.record_id ? log.record_id.slice(0, 8) + '…' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
