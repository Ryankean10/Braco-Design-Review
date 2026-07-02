import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import SiteAnalytics from '@/components/construction/SiteAnalytics'

export default async function AnalyticsPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const [{ data: site }, { data: logs }, { data: cables }] = await Promise.all([
    supabase.from('construction_sites').select('id, name, client').eq('id', siteId).single(),
    supabase.from('site_daily_logs')
      .select('log_date, total_manhours, weather_conditions, weather_description, weather_lost_hours, weather_impact, personnel, issues, summary')
      .eq('site_id', siteId)
      .order('log_date', { ascending: true }),
    supabase.from('cable_items').select('id, status').eq('site_id', siteId),
  ])

  if (!site) notFound()

  const totalCables = cables?.length ?? 0
  const completedCables = cables?.filter(c => c.status === 'Complete').length ?? 0

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="max-w-5xl mx-auto px-4 py-6">

        <div className="flex items-center gap-3 mb-6">
          <Link href={`/construction/${siteId}`}
            className="flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: 'var(--text-muted)' }}>
            <ArrowLeft size={14}/> Back to site
          </Link>
          <span style={{ color: 'var(--border)' }}>·</span>
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{site.name} — Analytics</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{site.client}</p>
          </div>
        </div>

        <SiteAnalytics
          logs={logs ?? []}
          totalCables={totalCables}
          completedCables={completedCables}
        />

      </div>
    </div>
  )
}
