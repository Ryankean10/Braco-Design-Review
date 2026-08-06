export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import HaulageClient from '@/components/haulage/HaulageClient'

export default async function HaulagePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: profile } = await admin.from('profiles').select('role, company_id').eq('id', user.id).single()
  if (!['superadmin','admin','engineer','project_manager'].includes(profile?.role ?? '')) redirect('/dashboard')

  const companyId = profile?.company_id
  const today = date ?? new Date().toISOString().slice(0, 10)

  const [
    { data: tasks },
    { data: sheets },
    { data: drivers },
    { data: vehicles },
    { data: projects },
  ] = await Promise.all([
    admin.from('haulage_tasks').select('*, people(name), haulage_vehicles(name,reg), projects(name)').eq('company_id', companyId).eq('task_date', today).order('sort_order'),
    admin.from('haulage_daily_sheets').select('*, people(name), haulage_sheet_lines(*)').eq('company_id', companyId).eq('sheet_date', today),
    admin.from('people').select('id, name, email, phone').eq('company_id', companyId).eq('is_active', true).order('name'),
    admin.from('haulage_vehicles').select('id, name, reg, category').eq('company_id', companyId).eq('is_active', true).order('name'),
    admin.from('projects').select('id, name').eq('company_id', companyId).order('name'),
  ])

  return (
    <HaulageClient
      date={today}
      tasks={tasks ?? []}
      sheets={sheets ?? []}
      drivers={drivers ?? []}
      vehicles={vehicles ?? []}
      projects={projects ?? []}
      companyId={companyId ?? ''}
      userRole={profile?.role ?? 'engineer'}
    />
  )
}
