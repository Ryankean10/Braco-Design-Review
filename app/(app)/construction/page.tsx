import { redirect } from 'next/navigation'
import Link from 'next/link'
import { HardHat, ArrowRight, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export default async function ConstructionIndexPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = (profile as any)?.role ?? ''
  if (role === 'client') redirect('/dashboard')

  const { data: sites } = await supabase
    .from('construction_sites')
    .select('*')
    .order('created_at', { ascending: false })

  // For each site get cable counts
  const siteSummaries = await Promise.all((sites ?? []).map(async site => {
    const { count: total }    = await supabase.from('cable_items').select('id', { count: 'exact', head: true }).eq('site_id', site.id)
    const { count: complete } = await supabase.from('cable_items').select('id', { count: 'exact', head: true }).eq('site_id', site.id).eq('overall_status', 'Complete')
    const { count: blocked }  = await supabase.from('cable_items').select('id', { count: 'exact', head: true }).eq('site_id', site.id).eq('overall_status', 'Blocked')
    return { ...site, total: total ?? 0, complete: complete ?? 0, blocked: blocked ?? 0 }
  }))

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <HardHat size={24} style={{ color: 'var(--accent)' }} />
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Construction</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Site cable registers, activity tracking &amp; daily logs</p>
        </div>
      </div>

      {siteSummaries.length === 0 ? (
        <div className="text-center py-20 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <HardHat size={36} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No construction sites yet</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Run the migration and seed scripts to add Dyce</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {siteSummaries.map(site => {
            const pct = site.total > 0 ? Math.round((site.complete / site.total) * 100) : 0
            return (
              <Link key={site.id} href={`/construction/${site.id}`}
                className="rounded-xl border p-5 hover:opacity-90 transition-opacity"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{site.name}</h2>
                      <span className="text-[10px] px-2 py-0.5 rounded-full capitalize"
                        style={{ background: site.status === 'active' ? 'rgba(74,222,128,0.12)' : 'var(--bg-elevated)', color: site.status === 'active' ? '#4ade80' : 'var(--text-muted)' }}>
                        {site.status}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {site.client}{site.location ? ` · ${site.location}` : ''}{site.voltage_kv ? ` · ${site.voltage_kv}kV` : ''}
                    </p>
                    <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span className="flex items-center gap-1"><CheckCircle2 size={11} style={{ color: '#4ade80' }} />{site.complete} complete</span>
                      <span className="flex items-center gap-1"><Clock size={11} />{site.total - site.complete - site.blocked} remaining</span>
                      {site.blocked > 0 && <span className="flex items-center gap-1"><AlertCircle size={11} style={{ color: '#f87171' }} />{site.blocked} blocked</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-2xl font-bold" style={{ color: pct === 100 ? '#4ade80' : 'var(--accent)' }}>{pct}%</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{site.total} cables</p>
                    </div>
                    <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
                  </div>
                </div>
                <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct === 100 ? '#4ade80' : 'var(--accent)' }} />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
