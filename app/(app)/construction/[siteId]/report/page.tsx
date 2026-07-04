import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ProgressReportDoc from '@/components/construction/ProgressReportDoc'
import PrintButton from '@/components/construction/PrintButton'

export default async function ConstructionReportPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as any)?.role === 'client') notFound()

  const { data: site } = await supabase
    .from('construction_sites')
    .select('*')
    .eq('id', siteId)
    .single()
  if (!site) notFound()

  const [
    { data: cables },
    { data: allLogs },
    { data: civilsActivities },
  ] = await Promise.all([
    supabase
      .from('cable_items')
      .select('cable_ref, package_name, mvs, overall_status, completion_pct, scope')
      .eq('site_id', siteId)
      .order('package_name'),
    supabase
      .from('site_daily_logs')
      .select('log_date, total_manhours')
      .eq('site_id', siteId)
      .order('log_date', { ascending: true }),
    supabase
      .from('civils_activities')
      .select('activity_group, category, status, progress_pct')
      .eq('site_id', siteId)
      .order('sort_order'),
  ])

  return (
    <div className="print-report">
      {/* Controls bar — hidden on print */}
      <div className="print:hidden flex items-center justify-between px-6 py-3 border-b sticky top-0 z-10"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-base)' }}>
        <Link href={`/construction/${siteId}`}
          className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={15} /> Back to site
        </Link>
        <PrintButton />
      </div>

      {/* Report content */}
      <div className="p-6 max-w-5xl mx-auto">
        <ProgressReportDoc
          siteName={site.name}
          client={site.client ?? ''}
          location={site.location ?? ''}
          voltageKv={site.voltage_kv ?? null}
          cables={cables ?? []}
          allLogs={allLogs ?? []}
          civilsActivities={civilsActivities ?? []}
        />
      </div>
    </div>
  )
}
