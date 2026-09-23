export const dynamic = 'force-dynamic'

import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import OnboardChat from '@/components/OnboardChat'

export default async function OnboardPage() {
  const headersList = await headers()
  const slug = headersList.get('x-company-slug') ?? 'braco'

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const { data: company } = await admin
    .from('companies')
    .select('name, logo_url, accent_color')
    .eq('slug', slug)
    .single()

  return (
    <OnboardChat
      accentColor={company?.accent_color ?? '#6c72f5'}
      logoUrl={company?.logo_url ?? null}
      companyName={company?.name ?? 'Safet Consultancy'}
    />
  )
}
