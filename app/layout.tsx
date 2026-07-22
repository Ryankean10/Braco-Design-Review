import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const slug = headersList.get('x-company-slug') ?? 'braco'

  const sb = createClient(
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
  const tagline = company?.tagline ?? 'BESS Project Platform'

  return {
    title: `${name} — ${tagline}`,
    description: tagline,
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased">{children}</body>
    </html>
  )
}
