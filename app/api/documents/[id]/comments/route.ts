import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: documentId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const { comment, parentId } = await req.json() as { comment: string; parentId?: string }

  if (!comment?.trim()) return NextResponse.json({ error: 'Comment required' }, { status: 400 })

  const { data: doc } = await supabase
    .from('documents')
    .select('project_id, doc_status')
    .eq('id', documentId)
    .single()
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: newComment, error: insertErr } = await supabase
    .from('document_comments')
    .insert({
      document_id: documentId,
      project_id: doc.project_id,
      parent_id: parentId ?? null,
      comment: comment.trim(),
      author_id: user.id,
      author_role: profile?.role ?? 'unknown',
    })
    .select()
    .single()

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  // Client comment on "Ready for Client Review" → auto-revert to Internal Review
  const isClient = profile?.role === 'client'
  if (isClient && doc.doc_status === 'Ready for Client Review') {
    await supabase
      .from('documents')
      .update({ doc_status: 'Internal Review' })
      .eq('id', documentId)

    await supabase.from('document_status_history').insert({
      document_id: documentId,
      project_id: doc.project_id,
      from_status: 'Ready for Client Review',
      to_status: 'Internal Review',
      changed_by: user.id,
      note: 'Automatically reverted — client comment submitted',
      triggered_by: 'client_comment',
    })
  }

  return NextResponse.json({ comment: newComment })
}
