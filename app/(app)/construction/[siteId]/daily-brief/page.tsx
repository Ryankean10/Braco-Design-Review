export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import DailyBriefPanel from '@/components/construction/DailyBriefPanel'

const admin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export default async function DailyBriefPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = (profile as any)?.role ?? ''
  if (!['superadmin', 'admin', 'engineer', 'project_manager'].includes(role)) redirect('/dashboard')

  const { data: site } = await admin
    .from('construction_sites')
    .select('id, name, location, status')
    .eq('id', siteId)
    .single()

  if (!site) redirect('/construction')

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
          <a href={`/construction/${siteId}`} style={{ color: 'var(--text-muted)' }}>← {site.name}</a>
        </p>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Daily Site Brief</h1>
        {site.location && (
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{site.location}</p>
        )}
      </div>
      <DailyBriefPanel siteId={siteId} />
    </div>
  )
}
