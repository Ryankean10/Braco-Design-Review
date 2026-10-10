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
  const darkTheme = (company as any)?.dark_theme      ?? false

  const brandVars = [
    `--accent: ${accent};`,
    `--accent-rgb: ${hexToRgb(accent)};`,
    ...(darkTheme ? [
      '--bg-base: #0a1628;',
      '--bg-surface: #0d1e35;',
      '--bg-elevated: #102040;',
      '--border: #1a3050;',
      '--text-primary: #f0f4f8;',
      '--text-secondary: #b0c4d8;',
      '--text-muted: #6888a0;',
      '--critical: #f87171;',
      '--success: #34d399;',
      '--bg-sidebar: #080f1c;',
      '--sidebar-border: #162030;',
      '--sidebar-text: #e0eaf4;',
      '--sidebar-muted: #7090a8;',
      '--sidebar-subtext: #5878a0;',
      '--sidebar-active-bg: rgba(200,216,232,0.12);',
      '--sidebar-active-text: #c8d8e8;',
      '--sidebar-hover-bg: rgba(200,216,232,0.06);',
    ] : []),
  ].join(' ')

  // Wave watermark SVG — shown for dark-theme companies (e.g. ONDA Marine)
  const waveWatermark = darkTheme ? (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 800 200"
      preserveAspectRatio="xMidYMid slice"
      style={{
        position: 'fixed', inset: 0, width: '100%', height: '100%',
        opacity: 0.035, pointerEvents: 'none', zIndex: 0,
      }}
    >
      <defs>
        <pattern id="wave" x="0" y="0" width="400" height="200" patternUnits="userSpaceOnUse">
          {/* Top wave row */}
          <polyline points="0,70 67,40 133,70 200,40 267,70 333,40 400,70"
            fill="none" stroke="white" strokeWidth="18" strokeLinejoin="miter" />
          {/* Bottom wave row */}
          <polyline points="0,110 67,80 133,110 200,80 267,110 333,80 400,110"
            fill="none" stroke="white" strokeWidth="18" strokeLinejoin="miter" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#wave)" />
    </svg>
  ) : null

  return (
    <>
      <style>{`:root { ${brandVars} }`}</style>
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)', position: 'relative' }}>
        {waveWatermark}
        <Sidebar profile={profile} company={company} />
        <main className="flex-1 overflow-y-auto" style={{ position: 'relative', zIndex: 1 }}>
          {children}
        </main>
        <HelpChat />
      </div>
    </>
  )
}
