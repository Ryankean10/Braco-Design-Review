import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: plant } = await supabase.from('plant_items').select('company_id').eq('id', id).single()
  if (!plant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const path = `${plant.company_id}/${id}/${Date.now()}-${file.name}`
  const bytes = await file.arrayBuffer()
  const { error: uploadError } = await admin.storage.from('plant-manuals').upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 })

  const { data, error } = await supabase.from('plant_manuals').insert({
    plant_id:    id,
    company_id:  plant.company_id,
    name:        file.name,
    storage_path: path,
    file_size:   file.size,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
