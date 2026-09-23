export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireRole, INTERNAL_ROLES } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id: projectId, docId } = await params
  const auth = await requireRole(INTERNAL_ROLES)
  if ('error' in auth) return auth.error
  const supabase = await createClient()

  const { data: doc } = await supabase
    .from('qcs_documents')
    .select('id, title, pdf_storage_path, project_id')
    .eq('id', docId)
    .eq('project_id', projectId)
    .single()

  if (!doc?.pdf_storage_path) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data, error } = await service.storage
    .from('project-qcs')
    .createSignedUrl(doc.pdf_storage_path, 120)

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Could not generate download link' }, { status: 500 })
  }

  return NextResponse.redirect(data.signedUrl)
}
