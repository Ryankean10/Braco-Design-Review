import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_STATUSES = ['WIP', 'Internal Review', 'Ready for Client Review', 'Approved for Construction'] as const
type DocStatus = typeof VALID_STATUSES[number]

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: documentId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, full_name, email').eq('id', user.id).single()
  if (!['admin', 'engineer'].includes(profile?.role ?? ''))
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const { status, note } = await req.json() as { status: DocStatus; note?: string }
  if (!VALID_STATUSES.includes(status))
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

  if (status === 'Approved for Construction' && profile?.role !== 'admin')
    return NextResponse.json({ error: 'Only admins can approve for construction' }, { status: 403 })

  const { data: doc } = await supabase
    .from('documents')
    .select('doc_status, project_id, doc_no, title, rev')
    .eq('id', documentId)
    .single()
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  // Block AFC if open comments remain
  if (status === 'Approved for Construction') {
    const { count } = await supabase
      .from('document_comments')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', documentId)
      .eq('status', 'open')
    if ((count ?? 0) > 0)
      return NextResponse.json({
        error: `Cannot approve — ${count} open comment${count !== 1 ? 's' : ''} must be resolved first`,
      }, { status: 422 })
  }

  await supabase.from('documents').update({ doc_status: status }).eq('id', documentId)

  await supabase.from('document_status_history').insert({
    document_id: documentId,
    project_id: doc.project_id,
    from_status: doc.doc_status,
    to_status: status,
    changed_by: user.id,
    note: note?.trim() || null,
    triggered_by: 'user',
  })

  // Notify all clients assigned to the project when sent for client review
  if (status === 'Ready for Client Review') {
    const { data: clientRows } = await supabase
      .from('project_clients')
      .select('user_id')
      .eq('project_id', doc.project_id)

    if (clientRows?.length) {
      const senderName = (profile as any)?.full_name ?? (profile as any)?.email ?? 'A team member'
      await supabase.from('notifications').insert(
        clientRows.map((c: any) => ({
          user_id: c.user_id,
          project_id: doc.project_id,
          document_id: documentId,
          type: 'document_review_requested',
          title: `Document ready for review: ${doc.doc_no} Rev ${doc.rev}`,
          body: `${doc.title} has been sent for your review by ${senderName}.${note ? ` Note: ${note}` : ''}`,
        }))
      )
    }
  }

  return NextResponse.json({ status })
}
