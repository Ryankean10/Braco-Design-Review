export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getCompanyContext } from '@/lib/getCompanyContext'
import { createClient as createAdmin } from '@supabase/supabase-js'
import CaptureForm from '@/components/capture/CaptureForm'

export default async function CapturePage() {
  const { user, profile, effectiveCompanyId } = await getCompanyContext()
  if (!user) redirect('/login')

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const companyId = effectiveCompanyId ?? (profile as any)?.company_id

  // Fetch projects this user is a member of (or all for admin)
  const role = (profile as any)?.role ?? 'engineer'
  let projects: { id: string; name: string }[] = []

  if (['superadmin', 'admin'].includes(role)) {
    const { data } = await admin
      .from('projects')
      .select('id, name')
      .eq('company_id', companyId)
      .order('name')
    projects = data ?? []
  } else {
    const { data: memberships } = await admin
      .from('project_members')
      .select('project_id, projects!inner(id, name)')
      .eq('user_id', user.id)
    projects = (memberships ?? []).map((m: any) => m.projects).filter(Boolean)
  }

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Field Capture</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Submit test results directly from site.</p>
      <CaptureForm projects={projects} userId={user.id} />
    </div>
  )
}
