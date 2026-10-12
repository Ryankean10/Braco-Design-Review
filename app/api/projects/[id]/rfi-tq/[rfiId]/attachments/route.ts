import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, INTERNAL_ROLES } from '@/lib/auth'

// GET — list attachments for an RFI/TQ
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; rfiId: string }> }) {
  const { id: projectId, rfiId } = await params
  const auth = await requireRole(INTERNAL_ROLES)
  if ('error' in auth) return auth.error

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('rfi_tq_attachments')
    .select('*')
    .eq('rfi_tq_id', rfiId)
    .eq('project_id', projectId)
    .order('uploaded_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — upload a file (multipart/form-data)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; rfiId: string }> }) {
  const { id: projectId, rfiId } = await params
  const auth = await requireRole(INTERNAL_ROLES)
  if ('error' in auth) return auth.error

  const supabase = await createClient()

  // Verify RFI/TQ belongs to this project
  const { data: rfi } = await supabase
    .from('rfis_tqs').select('id').eq('id', rfiId).eq('project_id', projectId).single()
  if (!rfi) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const ext = file.name.split('.').pop() ?? 'bin'
  const storagePath = `rfi-tq/${projectId}/${rfiId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

  const buf = Buffer.from(await file.arrayBuffer())
  const { error: upErr } = await supabase.storage
    .from('documents')
    .upload(storagePath, buf, { contentType: file.type || 'application/octet-stream', upsert: false })

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: att, error: dbErr } = await supabase
    .from('rfi_tq_attachments')
    .insert({
      rfi_tq_id: rfiId,
      project_id: projectId,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: auth.user.id,
    })
    .select()
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(att, { status: 201 })
}
