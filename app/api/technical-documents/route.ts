import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_ROLES = ['admin', 'engineer', 'project_manager']

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!ALLOWED_ROLES.includes(profile?.role ?? ''))
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const body = await req.json()
  const { project_id, title, doc_ref, source, doc_type, notes, storage_path, file_name, file_size, mime_type } = body

  if (!project_id || !title)
    return NextResponse.json({ error: 'project_id and title required' }, { status: 400 })

  const { data, error } = await supabase.from('technical_documents').insert({
    project_id, title, doc_ref: doc_ref || null, source: source || 'Other',
    doc_type: doc_type || 'Manual', notes: notes || null,
    storage_path: storage_path || null, file_name: file_name || null,
    file_size: file_size || null, mime_type: mime_type || null,
    uploaded_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
