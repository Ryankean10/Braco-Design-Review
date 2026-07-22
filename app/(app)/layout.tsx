import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import HelpChat from '@/components/HelpChat'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const headersList = await headers()
  const companySlug = headersList.get('x-company-slug') ?? 'braco'

  const [{ data: profile }, { data: company }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('companies').select('*').eq('slug', companySlug).single(),
  ])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      <Sidebar profile={profile} company={company} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <HelpChat />
    </div>
  )
}
