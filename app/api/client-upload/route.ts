import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getResendClient } from '@/lib/resend'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const ALERT_EMAIL = process.env.ALERT_EMAIL ?? 'admin@safetconsultancy.co.uk'

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

  let emailError: string | null = null

  if (inserts.length > 0) {
    await admin.from('client_template_uploads').insert(inserts)

    const { data: companyRow } = await admin.from('companies').select('name').eq('slug', slug).single()
    const companyName: string = (companyRow as any)?.name ?? slug
    const fileList = inserts
      .map((r, n) => `<tr><td style="padding:4px 8px;border-bottom:1px solid #333">${n + 1}. ${r.file_name}</td><td style="padding:4px 8px;border-bottom:1px solid #333;color:#aaa">${r.description}</td></tr>`)
      .join('')

    try {
      const { resend, fromEmail } = getResendClient(slug === 'scotplant' ? 'scotplant' : null)
      const result = await resend.emails.send({
        from: fromEmail,
        to: ALERT_EMAIL,
        subject: `📁 ${companyName} has uploaded ${inserts.length} template${inserts.length > 1 ? 's' : ''} — review required`,
        html: `
          <div style="font-family:sans-serif;max-width:600px">
            <h2 style="margin-bottom:4px">New client template upload</h2>
            <p style="color:#666;margin-top:0">${companyName} uploaded ${inserts.length} document${inserts.length > 1 ? 's' : ''} via the client portal.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
              <thead>
                <tr>
                  <th style="text-align:left;padding:4px 8px;border-bottom:2px solid #444">File</th>
                  <th style="text-align:left;padding:4px 8px;border-bottom:2px solid #444">Description</th>
                </tr>
              </thead>
              <tbody>${fileList}</tbody>
            </table>
            <p style="color:#888;font-size:12px">Review and configure these documents in the Safe T platform before ${companyName} goes live.</p>
          </div>
        `,
      })
      if (result.error) {
        emailError = JSON.stringify(result.error)
        console.error('[client-upload] Resend rejected:', emailError)
      } else {
        console.log('[client-upload] Email sent:', result.data?.id)
      }
    } catch (err) {
      emailError = String(err)
      console.error('[client-upload] Resend threw:', err)
    }
  }

  if (errors.length > 0 && inserts.length === 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  return NextResponse.json({ ok: true, count: inserts.length, errors, emailError })
}
