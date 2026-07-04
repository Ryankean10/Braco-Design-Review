import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ProgressReport from '@/components/construction/ProgressReport'

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

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      {/* Back button — hidden on print */}
      <div className="flex items-center gap-3 print:hidden">
        <Link href={`/construction/${siteId}`}
          className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={15} /> Back to site
        </Link>
      </div>

      <ProgressReport
        siteName={site.name}
        client={site.client ?? ''}
        cables={cables ?? []}
        allLogs={allLogs ?? []}
        civilsActivities={civilsActivities ?? []}
        reportDate={today}
      />
    </div>
  )
}
