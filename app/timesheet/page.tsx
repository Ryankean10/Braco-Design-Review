import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import TimesheetForm from '@/components/TimesheetForm'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export default async function TimesheetPage() {
  const headersList = await headers()
  const slug = headersList.get('x-company-slug') ?? 'braco'

  const { data: company } = await admin
    .from('companies')
    .select('name, logo_url, accent_color')
    .eq('slug', slug)
    .single()

  const companyName: string = (company as any)?.name ?? 'your organisation'
  const logoUrl: string | null = (company as any)?.logo_url ?? null
  const accentColor: string = (company as any)?.accent_color ?? '#6c72f5'

  return (
    <TimesheetForm
      companyName={companyName}
      logoUrl={logoUrl}
      accentColor={accentColor}
    />
  )
}
