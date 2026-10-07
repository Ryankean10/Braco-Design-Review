import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import HolidayBookingForm from '@/components/HolidayBookingForm'

export const dynamic = 'force-dynamic'

export default async function HolidayPage() {
  const headersList = await headers()
  const slug = headersList.get('x-company-slug') ?? 'braco'

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: company } = await admin
    .from('companies')
    .select('id, name, logo_url, accent_color')
    .eq('slug', slug)
    .single()

  const companyId: string | null = (company as any)?.id ?? null
  const companyName: string = (company as any)?.name ?? 'your organisation'
  const accentColor: string = (company as any)?.accent_color ?? '#6c72f5'

  const { data: people } = companyId
    ? await admin
        .from('people')
        .select('id, name, email')
        .eq('company_id', companyId)
        .order('name')
    : { data: [] }

  return (
    <HolidayBookingForm
      companyName={companyName}
      accentColor={accentColor}
      people={(people ?? []) as { id: string; name: string; email: string | null }[]}
    />
  )
}
