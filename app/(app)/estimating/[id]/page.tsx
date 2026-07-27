import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import EstimateDetail from '@/components/estimating/EstimateDetail'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function EstimateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: profile } = await admin.from('profiles').select('role, company_id').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const companyId = profile.company_id

  // Fetch estimate with items
  const { data: estimate } = await admin
    .from('estimates')
    .select('*, estimate_items(*)')
    .eq('id', id)
    .single()
  if (!estimate) redirect('/estimating')

  // Fetch people with rates (for manpower)
  const { data: people } = await admin
    .from('people')
    .select('id, name, role, standard_rate')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name')

  // Fetch approved holidays (for clash detection)
  const { data: holidays } = await admin
    .from('holiday_bookings')
    .select('id, person_id, start_date, end_date, status')
    .eq('company_id', companyId)
    .eq('status', 'Approved')

  // Fetch job library
  const { data: jobLibrary } = await admin
    .from('job_library')
    .select('*, job_library_items(*)')
    .eq('company_id', companyId)
    .order('name')

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <Link href="/estimating" className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
        <ChevronLeft size={13} /> All estimates
      </Link>
      <EstimateDetail
        estimate={estimate}
        people={people ?? []}
        holidays={holidays ?? []}
        jobLibrary={jobLibrary ?? []}
      />
    </div>
  )
}
