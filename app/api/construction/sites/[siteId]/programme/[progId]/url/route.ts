import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string; progId: string }> }
) {
  const { siteId, progId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: prog } = await supabase
    .from('construction_programmes')
    .select('file_path')
    .eq('id', progId)
    .eq('site_id', siteId)
    .single()

  if (!prog) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data } = await supabase.storage
    .from('construction-programmes')
    .createSignedUrl(prog.file_path, 3600)

  return NextResponse.json({ url: data?.signedUrl ?? null })
}
