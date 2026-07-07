import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: documentId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: doc } = await supabase
    .from('documents')
    .select('project_id')
    .eq('id', documentId)
    .single()
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await supabase.from('document_views').insert({
    document_id: documentId,
    project_id: doc.project_id,
    viewed_by: user.id,
  })

  return NextResponse.json({ ok: true })
}
