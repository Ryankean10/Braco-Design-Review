import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TrendingUp } from 'lucide-react'
import PersonnelPlanner from '@/components/planning/PersonnelPlanner'

export const dynamic = 'force-dynamic'

export default async function PlanningPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role, company_id').eq('id', user.id).single()
  const role = (profile as any)?.role ?? 'engineer'
  if (!['superadmin', 'admin', 'project_manager', 'engineer', 'operative'].includes(role)) redirect('/dashboard')

  const companyId = (profile as any)?.company_id ?? ''
  const canEdit = ['admin', 'superadmin', 'project_manager'].includes(role)

  const now = new Date()
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${lastDay}`

  const [{ data: people }, { data: assignments }] = await Promise.all([
    supabase.from('people').select('id, name, role, discipline, is_active').eq('company_id', companyId).eq('is_active', true).order('name'),
    (supabase as any).from('planner_assignments').select('*').eq('company_id', companyId).gte('date', from).lte('date', to).order('date'),
  ])

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Personnel Planner</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
          {canEdit ? 'Click any cell to assign a person to a job, meeting, or activity.' : 'View-only — contact an admin to make changes.'}
        </p>
      </div>
      {(people ?? []).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
          <TrendingUp size={40} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
          <p style={{ fontSize: 14 }}>No active people found. Add team members in the Team section first.</p>
        </div>
      ) : (
        <PersonnelPlanner
          people={(people ?? []) as any[]}
          initialAssignments={(assignments ?? []) as any[]}
          companyId={companyId}
          canEdit={canEdit}
        />
      )}
    </div>
  )
}
