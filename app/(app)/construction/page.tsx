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

  const siteSummaries = await Promise.all((sites ?? []).map(async site => {
    const [
      { count: total },
      { count: complete },
      { count: blocked },
      { data: civils },
    ] = await Promise.all([
      supabase.from('cable_items').select('id', { count: 'exact', head: true }).eq('site_id', site.id),
      supabase.from('cable_items').select('id', { count: 'exact', head: true }).eq('site_id', site.id).eq('overall_status', 'Complete'),
      supabase.from('cable_items').select('id', { count: 'exact', head: true }).eq('site_id', site.id).eq('overall_status', 'Blocked'),
      supabase.from('civils_activities').select('progress_pct, status, discipline').eq('site_id', site.id),
    ])

    const cableTotal    = total    ?? 0
    const cableComplete = complete ?? 0
    const cableBlocked  = blocked  ?? 0
    const cablePct = cableTotal > 0 ? Math.round((cableComplete / cableTotal) * 100) : 0

    const allActs = civils ?? []
    const avg = (rows: any[]) => rows.length > 0
      ? Math.round(rows.reduce((s: number, a: any) => s + (a.progress_pct ?? 0), 0) / rows.length)
      : null

    const civilsRows   = allActs.filter((a: any) => !a.discipline || a.discipline === 'Civils')
    const electricalRows = allActs.filter((a: any) => a.discipline === 'Electrical' || a.discipline === 'HV')
    const commRows     = allActs.filter((a: any) => a.discipline === 'Commissioning')

    const civilsPct      = avg(civilsRows)
    const electricalPct  = avg(electricalRows)
    const commPct        = avg(commRows)

    const disciplinePcts = [civilsPct, electricalPct, commPct].filter(p => p !== null) as number[]
    const overallPct = disciplinePcts.length > 0
      ? Math.round(disciplinePcts.reduce((s, p) => s + p, 0) / disciplinePcts.length)
      : cablePct

    return {
      ...site,
      total: cableTotal,
      complete: cableComplete,
      blocked: cableBlocked,
      cablePct,
      civilsPct,
      electricalPct,
      commPct,
      civilsTotal: civilsRows.length,
      civilsComplete: civilsRows.filter((a: any) => a.status === 'Complete').length,
      electricalTotal: electricalRows.length,
      electricalComplete: electricalRows.filter((a: any) => a.status === 'Complete').length,
      overallPct,
      hasActivities: allActs.length > 0,
    }
  }))

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <HardHat size={24} style={{ color: 'var(--accent)' }} />
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Construction</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Site registers, civils, activity tracking &amp; daily logs</p>
        </div>
      </div>

      {siteSummaries.length === 0 ? (
        <div className="text-center py-20 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <HardHat size={36} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No construction sites yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {siteSummaries.map(site => (
            <Link key={site.id} href={`/construction/${site.id}`}
              className="rounded-xl border p-5 hover:opacity-90 transition-opacity block"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>

              {/* Header row */}
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
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-2xl font-bold" style={{ color: site.overallPct === 100 ? '#4ade80' : 'var(--accent)' }}>
                      {site.overallPct}%
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {site.civilsPct !== null ? 'overall' : 'cables'}
                    </p>
                  </div>
                  <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
                </div>
              </div>

              {/* Discipline progress bars */}
              <div className="mt-3 space-y-1.5">
                {site.civilsPct !== null && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] w-14 text-right shrink-0" style={{ color: '#fb923c' }}>Civils</span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${site.civilsPct}%`, background: site.civilsPct === 100 ? '#4ade80' : '#fb923c' }} />
                    </div>
                    <span className="text-[10px] w-7 shrink-0 tabular-nums" style={{ color: '#fb923c' }}>{site.civilsPct}%</span>
                  </div>
                )}
                {site.electricalPct !== null && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] w-14 text-right shrink-0" style={{ color: 'var(--accent)' }}>Electrical</span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${site.electricalPct}%`, background: site.electricalPct === 100 ? '#4ade80' : 'var(--accent)' }} />
                    </div>
                    <span className="text-[10px] w-7 shrink-0 tabular-nums" style={{ color: 'var(--accent)' }}>{site.electricalPct}%</span>
                  </div>
                )}
                {site.commPct !== null && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] w-14 text-right shrink-0" style={{ color: '#a78bfa' }}>T&amp;C</span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${site.commPct}%`, background: site.commPct === 100 ? '#4ade80' : '#a78bfa' }} />
                    </div>
                    <span className="text-[10px] w-7 shrink-0 tabular-nums" style={{ color: '#a78bfa' }}>{site.commPct}%</span>
                  </div>
                )}
                {!site.hasActivities && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] w-14 text-right shrink-0" style={{ color: 'var(--text-muted)' }}>Cables</span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${site.cablePct}%`, background: site.cablePct === 100 ? '#4ade80' : 'var(--accent)' }} />
                    </div>
                    <span className="text-[10px] w-7 shrink-0 tabular-nums" style={{ color: 'var(--text-muted)' }}>{site.cablePct}%</span>
                  </div>
                )}
              </div>

              {/* Stat chips */}
              <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                {site.civilsPct !== null && (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 size={11} style={{ color: '#fb923c' }} />
                    {site.civilsComplete}/{site.civilsTotal} civils
                  </span>
                )}
                {site.electricalPct !== null && (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 size={11} style={{ color: 'var(--accent)' }} />
                    {site.electricalComplete}/{site.electricalTotal} electrical
                  </span>
                )}
                {site.total > 0 && (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 size={11} style={{ color: '#4ade80' }} />
                    {site.complete}/{site.total} cables
                  </span>
                )}
                {site.blocked > 0 && (
                  <span className="flex items-center gap-1">
                    <AlertCircle size={11} style={{ color: '#f87171' }} />
                    {site.blocked} blocked
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
