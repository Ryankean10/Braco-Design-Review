import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CostsDashboard from '@/components/admin/CostsDashboard'

export const dynamic = 'force-dynamic'

export default async function CostsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'superadmin') redirect('/dashboard')

  const [
    { data: companies },
    { data: subscriptions },
    { data: allocations },
    { data: hardware },
    { data: timeEntries },
    { data: invoices },
    { data: usageSummary },
  ] = await Promise.all([
    admin.from('companies').select('id, name, slug').order('name'),
    admin.from('cost_subscriptions').select('*').order('name'),
    admin.from('cost_subscription_allocations').select('*'),
    admin.from('cost_hardware').select('*').order('created_at', { ascending: false }),
    admin.from('cost_time_entries').select('*').order('entry_date', { ascending: false }),
    admin.from('invoices').select('*, invoice_line_items(*)').order('created_at', { ascending: false }),
    admin.from('api_usage_logs')
      .select('company_id, model, input_tokens, output_tokens, cost_usd, created_at')
      .order('created_at', { ascending: false })
      .limit(1000),
  ])

  return (
    <CostsDashboard
      companies={companies ?? []}
      subscriptions={subscriptions ?? []}
      allocations={allocations ?? []}
      hardware={hardware ?? []}
      timeEntries={timeEntries ?? []}
      invoices={invoices ?? []}
      usageLogs={usageSummary ?? []}
    />
  )
}
