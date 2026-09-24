import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(req: NextRequest) {
  const slug = req.headers.get('x-company-slug') ?? 'unknown'

  const { data: company } = await admin
    .from('companies')
    .select('id')
    .eq('slug', slug)
    .single()
  const companyId: string | null = (company as any)?.id ?? null

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  // Collect files and descriptions — form fields are file_0, file_1, ... and desc_0, desc_1, ...
  const inserts: { company_id: string | null; company_slug: string; file_name: string; description: string; storage_path: string }[] = []
  const errors: string[] = []
  let i = 0

  while (form.has(`file_${i}`)) {
    const file = form.get(`file_${i}`) as File | null
    const desc = (form.get(`desc_${i}`) as string | null)?.trim() ?? ''

    if (!file) { i++; continue }
    if (!desc) {
      errors.push(`Missing description for ${file.name}`)
      i++
      continue
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${slug}/${Date.now()}-${safeName}`
    const buf = Buffer.from(await file.arrayBuffer())

    const { error: upErr } = await admin.storage
      .from('client-templates')
      .upload(storagePath, buf, { contentType: file.type || 'application/octet-stream', upsert: false })

    if (upErr) {
      errors.push(`Upload failed for ${file.name}: ${upErr.message}`)
    } else {
      inserts.push({ company_id: companyId, company_slug: slug, file_name: file.name, description: desc, storage_path: storagePath })
    }

    i++
  }

  if (inserts.length > 0) {
    await admin.from('client_template_uploads').insert(inserts)
  }

  if (errors.length > 0 && inserts.length === 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  return NextResponse.json({ ok: true, count: inserts.length, errors })
}
