import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { FolderOpen } from 'lucide-react'

export default async function DocumentsPage() {
  const supabase = await createClient()

  const { data: docs } = await supabase
    .from('documents')
    .select('*, vessels(id,name)')
    .order('category')
    .order('title')

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Documents</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Fleet-wide document library · {docs?.length ?? 0} documents
        </p>
      </div>

      {(!docs || docs.length === 0) && (
        <div className="text-center py-16">
          <FolderOpen size={40} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>No documents uploaded</p>
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--bg-elevated)' }}>
              {['Vessel', 'Title', 'Category', 'Type', 'Rev', 'Issue Date', 'Expiry', 'Status'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium"
                    style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(docs ?? []).map((doc, i) => (
              <tr key={doc.id}
                  style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)' }}>
                <td className="px-4 py-2.5 text-xs">
                  <Link href={`/vessels/${(doc.vessels as any)?.id}/documents`} style={{ color: 'var(--accent)' }}>
                    {(doc.vessels as any)?.name ?? '—'}
                  </Link>
                </td>
                <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>{doc.title}</td>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{doc.category}</td>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{doc.type}</td>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{doc.rev ?? '—'}</td>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{doc.issue_date ?? '—'}</td>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{doc.expiry_date ?? '—'}</td>
                <td className="px-4 py-2.5 text-xs">
                  <span className={`px-1.5 py-0.5 rounded ${
                    doc.status === 'valid' ? 'badge-success' :
                    doc.status === 'expired' ? 'badge-critical' :
                    doc.status === 'expiring_soon' ? 'badge-minor' : 'badge-neutral'
                  }`}>{doc.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
