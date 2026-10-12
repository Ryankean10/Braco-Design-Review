import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

async function auth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: profile } = await admin.from('profiles').select('role, company_id').eq('id', user.id).single()
  if (!profile) return null
  return { admin, profile, supabase, userId: user.id }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: estimateId } = await params
  const ctx = await auth()
  if (!ctx) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data, error } = await ctx.admin
    .from('estimate_documents')
    .select('*')
    .eq('estimate_id', estimateId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: estimateId } = await params
  const ctx = await auth()
  if (!ctx) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const storagePath = `estimates/${estimateId}/docs/${Date.now()}-${file.name}`

  const { error: uploadErr } = await ctx.admin.storage
    .from('estimate-documents')
    .upload(storagePath, buf, { contentType: file.type || 'application/octet-stream', upsert: false })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data, error } = await ctx.admin
    .from('estimate_documents')
    .insert({ estimate_id: estimateId, name: file.name, storage_path: storagePath, file_size: buf.length, file_type: ext })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
