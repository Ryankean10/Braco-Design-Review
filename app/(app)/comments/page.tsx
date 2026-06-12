import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CommentsRegisterClient from '@/components/CommentsRegisterClient'

export default async function CommentsRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? 'engineer'
  if (role === 'operative' || role === 'client') redirect('/dashboard')

  const { project: projectFilter } = await searchParams

  let query = supabase
    .from('client_comments')
    .select('*, comment_attachments(*), projects(name, client), creator:profiles!created_by(full_name), responder:profiles!responded_by(full_name)')
    .order('created_at', { ascending: false })

  if (projectFilter) query = query.eq('project_id', projectFilter)

  const { data: comments } = await query

  const mapped = (comments ?? []).map((c: any) => ({
    ...c,
    creator_name:   c.creator?.full_name   ?? null,
    responder_name: c.responder?.full_name ?? null,
  }))

  return (
    <CommentsRegisterClient
      initialComments={mapped}
      userId={user.id}
      projectFilter={projectFilter ?? null}
    />
  )
}
