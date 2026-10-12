export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getCompanyContext } from '@/lib/getCompanyContext'
import InboxTab from '@/components/team/InboxTab'

export default async function InboxPage() {
  const { user, profile, company } = await getCompanyContext()
  if (!user) redirect('/login')
  if (company?.slug !== 'scotplant') redirect('/dashboard')
  if (!['superadmin', 'admin'].includes((profile as any)?.role ?? '')) redirect('/dashboard')

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>Email Inbox</h1>
      <InboxTab />
    </div>
  )
}
