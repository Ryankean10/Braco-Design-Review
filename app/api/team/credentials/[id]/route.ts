import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const { credential_type, name, issuer, reference, issue_date, expiry_date, notes } = body

  const { data, error } = await supabase
    .from('person_credentials')
    .update({ credential_type, name, issuer: issuer||null, reference: reference||null, issue_date: issue_date||null, expiry_date: expiry_date||null, notes: notes||null })
    .eq('id', id)
    .select('*, certificates:person_certificates(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Delete certificate files from storage first
  const svc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: certs } = await supabase.from('person_certificates').select('storage_path').eq('credential_id', id)
  if (certs?.length) {
    await svc.storage.from('person-certificates').remove(certs.map(c => c.storage_path))
  }

  const { error } = await supabase.from('person_credentials').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
