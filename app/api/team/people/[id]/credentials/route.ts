import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, MANAGER_ROLES } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireRole(MANAGER_ROLES)
  if ('error' in auth) return auth.error

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('person_credentials')
    .select('*, certificates:person_certificates(*)')
    .eq('person_id', id)
    .order('expiry_date', { ascending: true, nullsFirst: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireRole(MANAGER_ROLES)
  if ('error' in auth) return auth.error

  const supabase = await createClient()
  const body = await req.json()
  const { credential_type, name, issuer, reference, issue_date, expiry_date, notes } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('person_credentials')
    .insert({
      person_id: id,
      credential_type: credential_type || 'certification',
      name: name.trim(),
      issuer: issuer || null,
      reference: reference || null,
      issue_date: issue_date || null,
      expiry_date: expiry_date || null,
      notes: notes || null,
    })
    .select('*, certificates:person_certificates(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
