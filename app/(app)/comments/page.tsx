import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CommentsRegisterClient from '@/components/CommentsRegisterClient'

export default async function CommentsRegisterPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? 'engineer'

  // Operatives and clients don't see this register
  if (role === 'operative' || role === 'client') redirect('/dashboard')

  const { data: comments } = await supabase
    .from('client_comments')
    .select('*, projects(name, client)')
    .order('created_at', { ascending: false })

  return (
    <CommentsRegisterClient
      initialComments={(comments ?? []) as any}
      userId={user.id}
    />
  )
}
