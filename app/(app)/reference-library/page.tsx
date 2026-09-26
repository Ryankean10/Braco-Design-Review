import { redirect } from 'next/navigation'
import { getCompanyContext } from '@/lib/getCompanyContext'
import ReferenceLibraryClient from '@/components/ReferenceLibraryClient'

export default async function ReferenceLibraryPage() {
  const { supabase, role, effectiveCompanyId, isSuperAdmin } = await getCompanyContext()
  if (role === 'client') redirect('/dashboard')
  const isAdmin = ['admin', 'superadmin'].includes(role)

  // Templates: platform-wide (company_id null) plus the active company's own
  let templatesQuery = supabase.from('reference_templates').select('*').order('category').order('title')
  templatesQuery = effectiveCompanyId
    ? templatesQuery.or(`company_id.is.null,company_id.eq.${effectiveCompanyId}`)
    : templatesQuery.is('company_id', null)

  const [{ data: standards }, { data: hsRefs }, { data: lessons }, { data: opRules }, { data: templates }] = await Promise.all([
    supabase.from('standards').select('*, standard_clauses(*), ai_summary, ai_key_points, ai_bess_applicability, ai_analysed_at').order('category').order('ref'),
    supabase.from('hs_references').select('*').order('category').order('ref'),
    supabase.from('lessons_learned').select('*').order('created_at', { ascending: false }),
    supabase.from('operator_rules').select('*').order('operator').order('category'),
    templatesQuery,
  ])

  return (
    <ReferenceLibraryClient
      standards={standards ?? []}
      hsRefs={hsRefs ?? []}
      lessons={lessons ?? []}
      opRules={opRules ?? []}
      templates={templates ?? []}
      companyId={effectiveCompanyId}
      isAdmin={isAdmin}
      isSuperAdmin={isSuperAdmin}
    />
  )
}
