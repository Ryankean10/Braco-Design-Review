import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import ClientTemplateUpload from '@/components/ClientTemplateUpload'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export default async function ClientUploadPage() {
  const headersList = await headers()
  const slug = headersList.get('x-company-slug') ?? 'braco'

  const { data: company } = await admin
    .from('companies')
    .select('name, logo_url, accent_color')
    .eq('slug', slug)
    .single()

  const companyName: string = (company as any)?.name ?? 'your organisation'
  const logoUrl: string | null = (company as any)?.logo_url ?? null
  const accentColor: string = (company as any)?.accent_color ?? '#3b82f6'

  return (
    <ClientTemplateUpload
      companyName={companyName}
      logoUrl={logoUrl}
      accentColor={accentColor}
    />
  )
}
