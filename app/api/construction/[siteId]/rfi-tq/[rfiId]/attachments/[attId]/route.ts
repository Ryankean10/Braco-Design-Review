import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, INTERNAL_ROLES } from '@/lib/auth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ siteId: string; rfiId: string; attId: string }> }) {
  const { attId } = await params
  const auth = await requireRole(INTERNAL_ROLES)
  if ('error' in auth) return auth.error

  const supabase = await createClient()
  const { data: att } = await supabase
    .from('rfi_tq_attachments')
    .select('storage_path, file_name')
    .eq('id', attId)
    .single()
  if (!att) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data } = await supabase.storage.from('documents').createSignedUrl(att.storage_path, 300)
  if (!data?.signedUrl) return NextResponse.json({ error: 'Could not sign URL' }, { status: 500 })
  return NextResponse.json({ url: data.signedUrl, file_name: att.file_name })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ siteId: string; rfiId: string; attId: string }> }) {
  const { attId } = await params
  const auth = await requireRole(INTERNAL_ROLES)
  if ('error' in auth) return auth.error

  const supabase = await createClient()
  const { data: att } = await supabase
    .from('rfi_tq_attachments')
    .select('storage_path')
    .eq('id', attId)
    .single()
  if (!att) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await supabase.storage.from('documents').remove([att.storage_path])
  await supabase.from('rfi_tq_attachments').delete().eq('id', attId)
  return NextResponse.json({ ok: true })
}
