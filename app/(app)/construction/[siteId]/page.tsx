import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, HardHat, BookOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import CableRegister from '@/components/construction/CableRegister'
import SiteDashboard from '@/components/construction/SiteDashboard'
import ProgressReport from '@/components/construction/ProgressReport'
import ProgrammePanel from '@/components/construction/ProgrammePanel'

export default async function ConstructionSitePage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = (profile as any)?.role ?? ''
  if (role === 'client') notFound()

  const { data: site } = await supabase
    .from('construction_sites')
    .select('*, construction_packages(*)')
    .eq('id', siteId)
    .single()
  if (!site) notFound()

  // Fetch all cables with their activities
  const { data: cables } = await supabase
    .from('cable_items')
    .select('*, cable_activities(*)')
    .eq('site_id', siteId)
    .order('package_name').order('mvs').order('cable_ref')

  // Fetch last 7 daily logs for dashboard cards
  const { data: recentLogs } = await supabase
    .from('site_daily_logs')
    .select('*')
    .eq('site_id', siteId)
    .order('log_date', { ascending: false })
    .limit(7)

  // Fetch all logs for progress chart
  const { data: allLogs } = await supabase
    .from('site_daily_logs')
    .select('log_date, total_manhours, personnel')
    .eq('site_id', siteId)
    .order('log_date', { ascending: true })

  // Fetch open review items
  const { data: reviewItems } = await supabase
    .from('construction_review_items')
    .select('*')
    .eq('site_id', siteId)
    .eq('status', 'Open')
    .order('created_at', { ascending: false })

  // Generate signed URLs using service role (bypasses storage RLS)
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch programmes (latest first)
  const { data: programmes } = await serviceSupabase
    .from('construction_programmes')
    .select('*')
    .eq('site_id', siteId)
    .order('uploaded_at', { ascending: false })
  const signedUrls: Record<string, string> = {}
  for (const prog of programmes ?? []) {
    const { data } = await serviceSupabase.storage
      .from('construction-programmes')
      .createSignedUrl(prog.file_path, 3600)
    if (data?.signedUrl) signedUrls[prog.id] = data.signedUrl
  }

  const canEdit = ['admin', 'engineer'].includes(role)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/construction" className="hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={18} />
        </Link>
        <HardHat size={20} style={{ color: 'var(--accent)' }} />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{site.name}</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {site.client}{site.location ? ` · ${site.location}` : ''}{site.voltage_kv ? ` · ${site.voltage_kv}kV` : ''}
          </p>
        </div>
        {site.project_id && (
          <Link href={`/projects/${site.project_id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border hover:opacity-80"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
            <BookOpen size={12} /> Design module
          </Link>
        )}
      </div>

      {/* Progress report — screengrab-ready */}
      <ProgressReport
        siteName={site.name}
        client={site.client ?? ''}
        cables={cables ?? []}
        allLogs={allLogs ?? []}
      />

      {/* Dashboard rollup */}
      <SiteDashboard
        site={site}
        siteId={siteId}
        cables={cables ?? []}
        recentLogs={recentLogs ?? []}
        reviewItemCount={(reviewItems ?? []).length}
        canEdit={canEdit}
      />

      {/* P6 Programme */}
      <ProgrammePanel
        siteId={siteId}
        initialProgrammes={programmes ?? []}
        signedUrls={signedUrls}
        canEdit={canEdit}
      />

      {/* Unified cable register */}
      <CableRegister
        siteId={siteId}
        initialCables={cables ?? []}
        packages={(site as any).construction_packages ?? []}
        canEdit={canEdit}
      />
    </div>
  )
}
