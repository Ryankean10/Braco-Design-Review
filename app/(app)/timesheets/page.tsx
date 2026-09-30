import { getCompanyContext } from '@/lib/getCompanyContext'
import { redirect } from 'next/navigation'
import TimesheetApprovalClient from '@/components/TimesheetApprovalClient'

export const dynamic = 'force-dynamic'

export default async function TimesheetsPage() {
  const { supabase, role, effectiveCompanyId, isSuperAdmin } = await getCompanyContext()

  if (!['admin', 'superadmin', 'project_manager'].includes(role)) {
    redirect('/dashboard')
  }

  const { data: submissions } = await supabase
    .from('timesheet_submissions')
    .select('*')
    .eq('company_id', effectiveCompanyId)
    .order('submitted_at', { ascending: false })
    .limit(200)

  return (
    <div style={{ padding: '24px 28px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Timesheet Submissions
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
          Review and approve submitted timesheets
        </p>
      </div>
      <TimesheetApprovalClient
        initialSubmissions={(submissions ?? []) as any[]}
        companyId={effectiveCompanyId ?? ''}
      />
    </div>
  )
}
