import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, INTERNAL_ROLES } from '@/lib/auth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ siteId: string; rfiId: string }> }) {
  const { rfiId } = await params
  const auth = await requireRole(INTERNAL_ROLES)
  if ('error' in auth) return auth.error

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('rfi_tq_attachments')
    .select('*')
    .eq('rfi_tq_id', rfiId)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ siteId: string; rfiId: string }> }) {
  const { siteId, rfiId } = await params
  const auth = await requireRole(INTERNAL_ROLES)
  if ('error' in auth) return auth.error

  const supabase = await createClient()

  // Verify the RFI belongs to this site
  const { data: rfi } = await supabase
    .from('rfis_tqs')
    .select('id, project_id')
    .eq('id', rfiId)
    .eq('site_id', siteId)
    .single()
  if (!rfi) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const ext = file.name.split('.').pop()
  const storagePath = `rfi-tq/${rfi.project_id ?? siteId}/${rfiId}/${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, buffer, { contentType: file.type })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: row, error: dbError } = await supabase
    .from('rfi_tq_attachments')
    .insert({
      rfi_tq_id: rfiId,
      project_id: rfi.project_id,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: buffer.length,
      uploaded_by: auth.user.id,
    })
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(row, { status: 201 })
}
