import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireRole, INTERNAL_ROLES } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string; progId: string }> }
) {
  const { siteId, progId } = await params
  const auth = await requireRole(INTERNAL_ROLES)
  if ('error' in auth) return auth.error
  const supabase = await createClient()

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: prog } = await admin
    .from('construction_programmes')
    .select('file_path')
    .eq('id', progId)
    .eq('site_id', siteId)
    .single()

  if (!prog) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data } = await admin.storage
    .from('construction-programmes')
    .createSignedUrl(prog.file_path, 3600)

  return NextResponse.json({ url: data?.signedUrl ?? null })
}
