import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireRole, MANAGER_ROLES } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; certId: string }> }) {
  const { id, certId } = await params
  const auth = await requireRole(MANAGER_ROLES)
  if ('error' in auth) return auth.error
  const supabase = await createClient()

  // RLS scopes this to certificates the user's company can access
  const { data: cert } = await supabase
    .from('person_certificates')
    .select('id, storage_path')
    .eq('id', certId)
    .eq('credential_id', id)
    .single()
  if (!cert) return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })

  const { error } = await supabase.from('person_certificates').delete().eq('id', certId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const svc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  await svc.storage.from('person-certificates').remove([cert.storage_path])

  return NextResponse.json({ ok: true })
}
