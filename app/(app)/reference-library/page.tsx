import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReferenceLibraryClient from '@/components/ReferenceLibraryClient'

export default async function ReferenceLibraryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

  const [{ data: standards }, { data: hsRefs }, { data: lessons }, { data: opRules }] = await Promise.all([
    supabase.from('standards').select('*, standard_clauses(*)').order('category').order('ref'),
    supabase.from('hs_references').select('*').order('category').order('ref'),
    supabase.from('lessons_learned').select('*').order('created_at', { ascending: false }),
    supabase.from('operator_rules').select('*').order('operator').order('category'),
  ])

  return (
    <ReferenceLibraryClient
      standards={standards ?? []}
      hsRefs={hsRefs ?? []}
      lessons={lessons ?? []}
      opRules={opRules ?? []}
      isAdmin={isAdmin}
    />
  )
}
