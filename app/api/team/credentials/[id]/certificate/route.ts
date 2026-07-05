import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const cred = await supabase.from('person_credentials').select('person_id').eq('id', id).single()
  if (!cred.data) return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
  const personId = cred.data.person_id

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const ext = file.name.split('.').pop() ?? 'bin'
  const storagePath = `${personId}/${id}/${Date.now()}.${ext}`

  const svc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error: uploadErr } = await svc.storage
    .from('person-certificates')
    .upload(storagePath, await file.arrayBuffer(), { contentType: file.type, upsert: false })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data, error } = await supabase
    .from('person_certificates')
    .insert({ person_id: personId, credential_id: id, file_name: file.name, storage_path: storagePath })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Return signed URLs for all certificates on this credential
  const { data: certs } = await supabase.from('person_certificates').select('*').eq('credential_id', id)
  if (!certs?.length) return NextResponse.json([])

  const svc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const signed = await Promise.all(certs.map(async c => {
    const { data } = await svc.storage.from('person-certificates').createSignedUrl(c.storage_path, 3600)
    return { ...c, url: data?.signedUrl ?? null }
  }))

  return NextResponse.json(signed)
}
