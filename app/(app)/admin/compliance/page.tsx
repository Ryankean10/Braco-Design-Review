export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getCompanyContext } from '@/lib/getCompanyContext'
import { createClient as createAdmin } from '@supabase/supabase-js'
import ComplianceSettingsClient from '@/components/admin/ComplianceSettingsClient'

export default async function ComplianceSettingsPage() {
  const { user, profile, role, effectiveCompanyId } = await getCompanyContext()
  if (!user) redirect('/login')
  if (!['admin', 'superadmin'].includes(role)) redirect('/dashboard')

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const companyId = effectiveCompanyId ?? (profile as any)?.company_id

  const { data: settings } = await admin
    .from('company_compliance_settings')
    .select('*')
    .eq('company_id', companyId)
    .single()

  return (
    <div className="p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Compliance Alerts</h1>
      <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
        Configure when you receive alerts for expiring certifications and calibrations.
      </p>
      <ComplianceSettingsClient
        companyId={companyId}
        initial={settings ?? { warn_days_1: 60, warn_days_2: 30, alert_email: '' }}
      />
    </div>
  )
}
