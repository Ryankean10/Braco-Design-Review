import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { FolderOpen } from 'lucide-react'

const CAT_COLORS: Record<string, string> = {
  Class: 'badge-info', Safety: 'badge-critical', Technical: 'badge-neutral',
  Manual: 'badge-neutral', Legal: 'badge-minor', ISM: 'badge-info',
  ISPS: 'badge-info', MLC: 'badge-success', Crew: 'badge-success', Other: 'badge-neutral',
}

export default async function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: docs } = await supabase
    .from('documents')
    .select('*')
    .eq('vessel_id', id)
    .order('category')
    .order('title')

  const grouped = (docs ?? []).reduce<Record<string, typeof docs>>((acc, d) => {
    if (!acc[d.category]) acc[d.category] = []
    acc[d.category]!.push(d)
    return acc
  }, {})

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Documents</h2>
        <Link href={`/vessels/${id}/documents/new`}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white"
              style={{ background: 'var(--accent)' }}>
          + Upload Document
        </Link>
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="text-center py-16">
          <FolderOpen size={36} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>No documents uploaded</p>
        </div>
      )}

      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs px-2 py-0.5 rounded ${CAT_COLORS[cat] ?? 'badge-neutral'}`}>{cat}</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{items?.length} document{items?.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <table className="w-full text-sm">
              <tbody>
                {(items ?? []).map((doc, i) => (
                  <tr key={doc.id}
                      style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)' }}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                      {doc.title}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{doc.type}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{doc.doc_no ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>Rev {doc.rev ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {doc.expiry_date ? `Expires ${doc.expiry_date}` : ''}
                    </td>
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
      ))}
    </div>
  )
}
