import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CompaniesAdmin from '@/components/admin/CompaniesAdmin'

export const dynamic = 'force-dynamic'

export default async function CompaniesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'superadmin') redirect('/dashboard')

  const { data: companies } = await supabase
    .from('companies')
    .select('*')
    .order('name')

  return <CompaniesAdmin companies={companies ?? []} />
}
