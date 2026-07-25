import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Award } from 'lucide-react'

function certStatus(expiry: string | null, today: string) {
  if (!expiry) return { label: 'No Expiry', color: 'var(--text-muted)', days: null }
  const days = Math.ceil((new Date(expiry).getTime() - new Date(today).getTime()) / 86400000)
  if (days < 0) return { label: 'Expired', color: 'var(--critical)', days }
  if (days < 30) return { label: `${days}d — Critical`, color: 'var(--critical)', days }
  if (days < 90) return { label: `${days}d — Expiring`, color: 'var(--minor)', days }
  return { label: `${days}d`, color: 'var(--success)', days }
}

export default async function CertificatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: certs } = await supabase
    .from('certificates')
    .select('*')
    .eq('vessel_id', id)
    .order('expiry_date', { ascending: true, nullsFirst: false })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Certificates</h2>
        <Link href={`/vessels/${id}/certificates/new`}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white"
              style={{ background: 'var(--accent)' }}>
          + Add Certificate
        </Link>
      </div>

      {(!certs || certs.length === 0) && (
        <div className="text-center py-16">
          <Award size={36} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>No certificates registered</p>
        </div>
      )}

      {certs && certs.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-elevated)' }}>
                {['Certificate', 'Number', 'Issuing Authority', 'Issue Date', 'Expiry', 'Status'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium"
                      style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {certs.map((cert, i) => {
                const st = certStatus(cert.expiry_date, today)
                return (
                  <tr key={cert.id}
                      style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)' }}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                      {cert.name}
                      {cert.class_required && (
                        <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded badge-info">CLASS</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {cert.cert_number ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {cert.issuing_authority ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {cert.issue_date ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {cert.expiry_date ?? '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-semibold" style={{ color: st.color }}>{st.label}</span>
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
