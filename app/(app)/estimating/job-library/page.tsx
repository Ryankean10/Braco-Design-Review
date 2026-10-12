import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import JobLibraryManager from '@/components/estimating/JobLibraryManager'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function JobLibraryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: profile } = await admin.from('profiles').select('role, company_id').eq('id', user.id).single()
  if (!profile) redirect('/login')

  // Module gate
  if (profile.role !== 'superadmin') {
    const { data: company } = await admin.from('companies').select('modules').eq('id', profile.company_id).single()
    if (!((company?.modules as string[] ?? []).includes('estimating'))) redirect('/dashboard')
  }

  const { data: jobs } = await admin
    .from('job_library')
    .select('*, job_library_items(*)')
    .eq('company_id', profile.company_id)
    .order('name')

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <Link href="/estimating" className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
        <ChevronLeft size={13} /> Back to estimates
      </Link>
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Job Library</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Reusable job templates — import into any estimate</p>
      </div>
      <JobLibraryManager jobs={jobs ?? []} />
    </div>
  )
}
