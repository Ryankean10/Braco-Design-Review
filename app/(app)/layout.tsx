import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import Sidebar from '@/components/Sidebar'
import HelpChat from '@/components/HelpChat'

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const slug = headersList.get('x-company-slug') ?? 'braco'

  const sb = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const { data: company } = await sb
    .from('companies')
    .select('name, tagline')
    .eq('slug', slug)
    .single()

  const name    = company?.name    ?? 'MRRK'
  const tagline = company?.tagline ?? 'Project Management Platform'

  return {
    title: `${name} — ${tagline}`,
    description: tagline,
  }
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const headersList = await headers()
  const companySlug = headersList.get('x-company-slug') ?? 'braco'

  // Use service role for profile so superadmin visiting any subdomain
  // always gets their own profile/role, regardless of company RLS.
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const [{ data: profile }, { data: company }] = await Promise.all([
    admin.from('profiles').select('*').eq('id', user.id).single(),
    admin.from('companies').select('*').eq('slug', companySlug).single(),
  ])

  const accent    = (company as any)?.accent_color    ?? '#6C72F5'
  const secondary = (company as any)?.secondary_color ?? null

  const brandVars = [
    `--accent: ${accent};`,
    `--accent-rgb: ${hexToRgb(accent)};`,
  ].filter(Boolean).join(' ')

  return (
    <>
      {brandVars && <style>{`:root { ${brandVars} }`}</style>}
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
        <Sidebar profile={profile} company={company} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        <HelpChat />
      </div>
    </>
  )
}
