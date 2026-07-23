export const dynamic = 'force-dynamic'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import LoginForm from '@/components/LoginForm'

export default async function LoginPage() {
  const headersList = await headers()
  const slug = headersList.get('x-company-slug') ?? 'braco'

  const supabase = await createClient()
  const { data: company } = await supabase
    .from('companies')
    .select('name, logo_url, accent_color')
    .eq('slug', slug)
    .single()

  return (
    <LoginForm
      companyName={company?.name ?? 'Safe T Projects'}
      companySlug={slug}
      logoUrl={company?.logo_url ?? null}
      accentColor={company?.accent_color ?? '#2563eb'}
    />
  )
}
