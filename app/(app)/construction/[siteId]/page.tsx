export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, HardHat, BookOpen, FileBarChart2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import CableRegister from '@/components/construction/CableRegister'
import SiteDashboard from '@/components/construction/SiteDashboard'
import ProgrammePanel from '@/components/construction/ProgrammePanel'
import CivilsPanel from '@/components/construction/CivilsPanel'
import ItpPanel from '@/components/construction/ItpPanel'
import CollapsibleSection from '@/components/construction/CollapsibleSection'
import PersonnelMatchPanel from '@/components/construction/PersonnelMatchPanel'
import TimesheetUploadPanel from '@/components/construction/TimesheetUploadPanel'

export default async function ConstructionSitePage({ params, searchParams }: { params: Promise<{ siteId: string }>; searchParams: Promise<{ date?: string }> }) {
  const { siteId } = await params
  const { date: highlightDate } = await searchParams
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

  // Fetch civils activities and site diaries
  const { data: civilsActivities } = await supabase
    .from('civils_activities')
    .select('*')
    .eq('site_id', siteId)
    .order('sort_order')

  const { data: siteDiaries } = await supabase
    .from('site_diaries')
    .select('id, diary_date, file_name, ai_summary, ai_weather, ai_crew_count, ai_analysed_at, uploaded_at, ai_personnel')
    .eq('site_id', siteId)
    .order('diary_date', { ascending: false })
    .limit(20)

  // Fetch people appointed to this site for personnel matching
  const today = new Date().toISOString().slice(0, 10)
  const { data: siteAppointments } = await supabase
    .from('appointments')
    .select('person_id, end_date, people(name)')
    .eq('site_id', siteId)
    .or(`end_date.is.null,end_date.gte.${today}`)

  const appointedNames = (siteAppointments ?? []).map((a: any) => {
    const p = Array.isArray(a.people) ? a.people[0] : a.people
    return (p?.name ?? '').toLowerCase()
  }).filter(Boolean)

  // Collect diary personnel from last 7 days, find names not matched to appointed staff
  const recentDiaries = (siteDiaries ?? []).slice(0, 7)
  const diaryNames = [...new Set(recentDiaries.flatMap((d: any) => d.ai_personnel ?? []) as string[])]
  const unmatchedPersonnel: string[] = diaryNames.filter(name => {
    const n = name.toLowerCase().trim()
    if (!n) return false
    return !appointedNames.some(a => {
      // match on full name, or last name, or initial+surname (e.g. "B. Melrose" vs "Ben Melrose")
      if (a === n) return true
      const aParts = a.split(' ')
      const nParts = n.split(' ')
      const aLast = aParts[aParts.length - 1]
      const nLast = nParts[nParts.length - 1]
      if (aLast && nLast && aLast === nLast) return true
      return false
    })
  })

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

  // Fetch people for personnel matching dropdown
  const { data: allPeople } = await supabase
    .from('people')
    .select('id, name, role, company')
    .eq('is_active', true)
    .order('name')

  // Fetch diary name mappings to build nameToPersonId map for CivilsPanel
  const { data: nameMappings } = await supabase
    .from('diary_name_mappings')
    .select('raw_name, person_id')
    .eq('site_id', siteId)
    .not('person_id', 'is', null)

  const nameToPersonId: Record<string, string> = {}
  // Direct name → id from people table (covers email-parsed daily log personnel)
  for (const p of allPeople ?? []) {
    nameToPersonId[p.name] = p.id
  }
  // Diary name mappings override (raw diary name → confirmed person_id)
  for (const m of nameMappings ?? []) {
    if (m.person_id) nameToPersonId[m.raw_name] = m.person_id
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
        <div className="flex items-center gap-2">
          <Link href={`/construction/${siteId}/report`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border hover:opacity-80"
            style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>
            <FileBarChart2 size={12} /> Progress Report
          </Link>
          {site.project_id && (
            <Link href={`/projects/${site.project_id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border hover:opacity-80"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
              <BookOpen size={12} /> Design module
            </Link>
          )}
        </div>
      </div>

      {/* Dashboard rollup */}
      <SiteDashboard
        site={site}
        siteId={siteId}
        cables={cables ?? []}
        recentLogs={recentLogs ?? []}
        reviewItemCount={(reviewItems ?? []).length}
        canEdit={canEdit}
        civilsActivities={civilsActivities ?? []}
        unmatchedPersonnel={unmatchedPersonnel}
        nameToPersonId={nameToPersonId}
        highlightDate={highlightDate}
      />

      {/* Personnel matching */}
      <div id="personnel-matching" style={{ scrollMarginTop: '80px' }}>
      <CollapsibleSection
        title="Diary Personnel Matching"
        badge={undefined}
        summary="Match free-text diary names to people in the staff library"
      >
        <PersonnelMatchPanel siteId={siteId} people={(allPeople ?? []) as any} />
      </CollapsibleSection>
      </div>

      {/* Agency timesheet upload */}
      <CollapsibleSection
        title="Agency Timesheets"
        badge={undefined}
        summary="Upload agency XLS timesheets — auto-analysed, matched to staff, discrepancies flagged"
      >
        <TimesheetUploadPanel siteId={siteId} />
      </CollapsibleSection>

      {/* ITP — top-level, anchored so project page link lands here */}
      <div id="itp" style={{ scrollMarginTop: '80px' }}>
        <CollapsibleSection
          title="Inspection & Test Plan (ITP)"
          badge={undefined}
          summary="Upload and track ITP revisions — auto-seeds activity register"
        >
          <ItpPanel siteId={siteId} canEdit={canEdit} />
        </CollapsibleSection>
      </div>

      {/* P6 Programme */}
      <ProgrammePanel
        siteId={siteId}
        initialProgrammes={programmes ?? []}
        signedUrls={signedUrls}
        canEdit={canEdit}
      />

      {/* Civils Works (ECV) */}
      {(() => {
        const acts = (civilsActivities ?? []).filter(a => !a.discipline || a.discipline === 'Civils')
        const bg   = acts.filter(a => a.category === 'Below Ground')
        const ag   = acts.filter(a => a.category !== 'Below Ground')
        const complete = acts.filter(a => a.status === 'Complete').length
        const bgPct = bg.length ? Math.round(bg.reduce((s,a)=>s+a.progress_pct,0)/bg.length) : 0
        const agPct = ag.length ? Math.round(ag.reduce((s,a)=>s+a.progress_pct,0)/ag.length) : 0
        const pct   = acts.length ? Math.round(acts.reduce((s,a)=>s+a.progress_pct,0)/acts.length) : 0
        return (
          <CollapsibleSection
            title="Civils Works (ECV)"
            badge={acts.length > 0 ? `${pct}%` : undefined}
            summary={acts.length ? `below ground ${bgPct}% · above ground ${agPct}% · ${complete}/${acts.length} complete` : 'no activities seeded'}
          >
            <CivilsPanel siteId={siteId} initialActivities={civilsActivities ?? []} initialDiaries={siteDiaries ?? []} canEdit={canEdit} disciplineFilter="Civils" nameToPersonId={nameToPersonId} />
          </CollapsibleSection>
        )
      })()}

      {/* Electrical Works (EME) */}
      {(() => {
        const acts = (civilsActivities ?? []).filter(a => a.discipline === 'Electrical' || a.discipline === 'HV')
        const complete = acts.filter(a => a.status === 'Complete').length
        const pct = acts.length ? Math.round(acts.reduce((s,a)=>s+a.progress_pct,0)/acts.length) : 0
        return (
          <CollapsibleSection
            title="Electrical Works (EME)"
            badge={acts.length > 0 ? `${pct}%` : undefined}
            summary={acts.length ? `${complete}/${acts.length} activities complete · ITP assurance driven` : 'no activities seeded'}
          >
            <CivilsPanel siteId={siteId} initialActivities={civilsActivities ?? []} initialDiaries={siteDiaries ?? []} canEdit={canEdit} disciplineFilter="Electrical" nameToPersonId={nameToPersonId} />
          </CollapsibleSection>
        )
      })()}

      {/* Test & Commissioning */}
      {(() => {
        const acts = (civilsActivities ?? []).filter(a => a.discipline === 'Commissioning')
        const complete = acts.filter(a => a.status === 'Complete').length
        const pct = acts.length ? Math.round(acts.reduce((s,a)=>s+a.progress_pct,0)/acts.length) : 0
        return (
          <CollapsibleSection
            title="Test & Commissioning"
            badge={acts.length > 0 ? `${pct}%` : undefined}
            summary={acts.length ? `${complete}/${acts.length} activities complete · G99 / ITP sign-off driven` : 'no activities seeded'}
          >
            <CivilsPanel siteId={siteId} initialActivities={civilsActivities ?? []} initialDiaries={siteDiaries ?? []} canEdit={canEdit} disciplineFilter="Commissioning" nameToPersonId={nameToPersonId} />
          </CollapsibleSection>
        )
      })()}

      {/* Unified cable register */}
      <CollapsibleSection
        title="Cable Schedule"
        badge={(cables ?? []).length}
        summary={(() => {
          const cs = cables ?? []
          const complete = cs.filter(c => c.overall_status === 'Complete').length
          const blocked  = cs.filter(c => c.overall_status === 'Blocked').length
          const pct      = cs.length > 0 ? Math.round((complete / cs.length) * 100) : 0
          return `${pct}% complete · ${complete}/${cs.length} cables${blocked > 0 ? ` · ${blocked} blocked` : ''}`
        })()}
      >
        <CableRegister
          siteId={siteId}
          initialCables={cables ?? []}
          packages={(site as any).construction_packages ?? []}
          canEdit={canEdit}
        />
      </CollapsibleSection>
    </div>
  )
}
