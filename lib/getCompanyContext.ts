import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * Resolves the active company context from the subdomain slug.
 * The slug always wins for data scoping — even superadmins see only the
 * company whose subdomain they are visiting.
 */
export async function getCompanyContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const headersList = await headers()
  const slug = headersList.get('x-company-slug') ?? 'braco'

  const [{ data: profile }, { data: company }] = await Promise.all([
    supabase.from('profiles').select('role, full_name, email, company_id').eq('id', user.id).single(),
    supabase.from('companies').select('id, name, slug, tagline, industry, modules, accent_color, logo_url').eq('slug', slug).single(),
  ])

  const role = (profile as any)?.role ?? 'engineer'

  // Subdomain slug is authoritative — superadmins visiting scotplant.* see
  // only Scotplant data, just like a Scotplant user would.
  const effectiveCompanyId: string | null = (company as any)?.id ?? (profile as any)?.company_id ?? null

  return {
    supabase,
    user,
    profile: profile as any,
    role,
    slug,
    company: company as any,
    effectiveCompanyId,
    isSuperAdmin: role === 'superadmin',
    canEdit: ['superadmin', 'admin', 'engineer', 'project_manager'].includes(role),
  }
}
