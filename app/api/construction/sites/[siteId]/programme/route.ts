import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('construction_programmes')
    .select('*')
    .eq('site_id', siteId)
    .order('uploaded_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = (profile as any)?.role ?? ''
  if (!['admin', 'engineer', 'project_manager'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const revision = formData.get('revision') as string
  const programme_date = formData.get('programme_date') as string
  const notes = formData.get('notes') as string | null

  if (!file || !revision || !programme_date) {
    return NextResponse.json({ error: 'file, revision, and programme_date are required' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'pdf'
  const filePath = `${siteId}/${Date.now()}_${revision.replace(/[^a-zA-Z0-9]/g, '_')}.${ext}`

  // Use service role for storage + insert to bypass RLS
  const admin = serviceClient()

  const { error: uploadErr } = await admin.storage
    .from('construction-programmes')
    .upload(filePath, file, { contentType: file.type || 'application/pdf' })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data, error } = await admin
    .from('construction_programmes')
    .insert({
      site_id: siteId,
      revision,
      programme_date,
      file_path: filePath,
      file_name: file.name,
      notes: notes || null,
      uploaded_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fire-and-forget AI analysis — client polls for result
  const baseUrl = request.nextUrl.origin
  fetch(`${baseUrl}/api/construction/sites/${siteId}/programme/${data.id}/analyse`, {
    method: 'POST',
    headers: { cookie: request.headers.get('cookie') ?? '' }
  }).catch(() => {})

  return NextResponse.json(data)
}
