import { headers } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The company whose data the current request should be scoped to.
 *
 * - superadmin: the company whose subdomain they are on (scotplant.*, boreaspower.*, …),
 *   so a superadmin sees each platform's own data rather than their profile's home company.
 * - everyone else: always their own profile company — the subdomain never widens access.
 */
export async function resolveActiveCompanyId(
  supabase: SupabaseClient,
  role: string | null | undefined,
  profileCompanyId: string | null | undefined,
): Promise<string | null> {
  if (role !== 'superadmin') return profileCompanyId ?? null

  const slug = (await headers()).get('x-company-slug')
  if (!slug) return profileCompanyId ?? null

  const { data: company } = await supabase.from('companies').select('id').eq('slug', slug).maybeSingle()
  return (company as { id: string } | null)?.id ?? profileCompanyId ?? null
}
