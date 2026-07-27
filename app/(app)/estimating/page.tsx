import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { Plus, FileText, BookOpen } from 'lucide-react'
import NewEstimateButton from './NewEstimateButton'

export const dynamic = 'force-dynamic'

const GBP = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n)

export default async function EstimatingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: profile } = await admin.from('profiles').select('role, company_id').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const query = admin.from('estimates').select('*, estimate_items(total_cost, markup_pct)').order('created_at', { ascending: false })
  if (profile.role !== 'superadmin') query.eq('company_id', profile.company_id)
  const { data: estimates } = await query

  const STATUS_COLORS: Record<string, string> = { draft: '#94a3b8', sent: '#f59e0b', accepted: '#10b981', rejected: '#ef4444', void: '#6b7280' }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Estimating</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Quotes, tenders & job pricing</p>
        </div>
        <div className="flex gap-2">
          <Link href="/estimating/job-library" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <BookOpen size={14} /> Job Library
          </Link>
          <NewEstimateButton />
        </div>
      </div>

      {(!estimates || estimates.length === 0) ? (
        <div className="rounded-xl border p-12 text-center" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <FileText size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No estimates yet</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Create your first estimate to start pricing jobs.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                {['Reference', 'Title', 'Client', 'Status', 'Total (inc. VAT)', 'Dates', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(estimates ?? []).map((est: any) => {
                const subtotal = (est.estimate_items ?? []).reduce((s: number, i: any) => s + i.total_cost * (1 + i.markup_pct / 100), 0)
                const grandTotal = subtotal * 1.20
                return (
                  <tr key={est.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{est.reference}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{est.title}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{est.client_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white" style={{ background: STATUS_COLORS[est.status] ?? '#94a3b8' }}>{est.status}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text-primary)' }}>{GBP(grandTotal)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {est.start_date ?? '—'}{est.end_date ? ` → ${est.end_date}` : ''}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/estimating/${est.id}`} className="text-xs px-2.5 py-1 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Open</Link>
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
