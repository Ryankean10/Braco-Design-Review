export const dynamic = 'force-dynamic'

import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import LoginForm from '@/components/LoginForm'

export default async function LoginPage() {
  const headersList = await headers()
  const slug = headersList.get('x-company-slug') ?? 'braco'

  // Use service role to bypass RLS — login page has no auth session yet
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const { data: company } = await admin
    .from('companies')
    .select('name, logo_url, accent_color, login_bg')
    .eq('slug', slug)
    .single()

  return (
    <LoginForm
      companyName={company?.name ?? 'Safe T Projects'}
      companySlug={slug}
      logoUrl={company?.logo_url ?? null}
      accentColor={company?.accent_color ?? '#2563eb'}
      loginBg={(company as any)?.login_bg ?? 'dark'}
    />
  )
}
