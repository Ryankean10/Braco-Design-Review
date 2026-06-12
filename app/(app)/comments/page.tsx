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

  // Load comments + attachments + project name
  let query = supabase
    .from('client_comments')
    .select('*, comment_attachments(*), projects(id, name, client)')
    .order('created_at', { ascending: false })

  if (projectFilter) query = query.eq('project_id', projectFilter)

  const { data: comments } = await query

  // Collect all user IDs involved so we can look up display names in one query
  const userIds = new Set<string>()
  for (const c of comments ?? []) {
    if (c.created_by)   userIds.add(c.created_by)
    if (c.responded_by) userIds.add(c.responded_by)
  }

  const { data: profiles } = userIds.size > 0
    ? await supabase.from('profiles').select('id, full_name, email').in('id', [...userIds])
    : { data: [] }

  const nameMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.full_name ?? p.email ?? 'Unknown']))

  const mapped = (comments ?? []).map((c: any) => ({
    ...c,
    creator_name:   c.created_by   ? (nameMap[c.created_by]   ?? null) : null,
    responder_name: c.responded_by ? (nameMap[c.responded_by] ?? null) : null,
  }))

  return (
    <CommentsRegisterClient
      initialComments={mapped}
      userId={user.id}
      projectFilter={projectFilter ?? null}
    />
  )
}
