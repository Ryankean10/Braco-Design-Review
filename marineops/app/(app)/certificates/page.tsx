import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

function certStatusBadge(expiry: string | null, today: string) {
  if (!expiry) return { cls: 'badge-neutral', label: 'No Expiry' }
  const days = Math.ceil((new Date(expiry).getTime() - new Date(today).getTime()) / 86400000)
  if (days < 0) return { cls: 'badge-critical', label: 'Expired' }
  if (days < 30) return { cls: 'badge-critical', label: `${days}d` }
  if (days < 90) return { cls: 'badge-minor', label: `${days}d` }
  return { cls: 'badge-success', label: `${days}d` }
}

export default async function CertificatesPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: certs } = await supabase
    .from('certificates')
    .select('*, vessels(id,name)')
    .order('expiry_date', { ascending: true, nullsFirst: false })

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Certificates</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Fleet-wide certificate tracker</p>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--bg-elevated)' }}>
              {['Vessel', 'Certificate', 'Number', 'Issuing Authority', 'Expiry', 'Remaining'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium"
                    style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(certs ?? []).map((cert, i) => {
              const st = certStatusBadge(cert.expiry_date, today)
              return (
                <tr key={cert.id}
                    style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)' }}>
                  <td className="px-4 py-2.5 text-xs">
                    <Link href={`/vessels/${(cert.vessels as any)?.id}/certificates`}
                          style={{ color: 'var(--accent)' }}>
                      {(cert.vessels as any)?.name ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                    {cert.name}
                    {cert.class_required && <span className="ml-1.5 text-xs px-1 py-0.5 rounded badge-info">CLASS</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{cert.cert_number ?? '—'}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{cert.issuing_authority ?? '—'}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{cert.expiry_date ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${st.cls}`}>{st.label}</span>
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
