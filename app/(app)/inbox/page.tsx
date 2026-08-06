export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import InboxTab from '@/components/team/InboxTab'

export default async function InboxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['superadmin', 'admin'].includes((profile as any)?.role ?? '')) redirect('/dashboard')

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>Email Inbox</h1>
      <InboxTab />
    </div>
  )
}
