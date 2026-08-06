import { NextRequest, NextResponse } from 'next/server'
import { requireRole, MANAGER_ROLES } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { parseDriverReply } from '@/lib/haulage-parser'

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

export async function POST(req: NextRequest) {
  const auth = await requireRole(MANAGER_ROLES)
  if ('error' in auth) return auth.error

  const { emailInboxId } = await req.json()
  if (!emailInboxId) return NextResponse.json({ error: 'emailInboxId required' }, { status: 400 })

  const db = admin()

  const { data: email } = await db
    .from('email_inbox')
    .select('*, people(id, company_id)')
    .eq('id', emailInboxId)
    .single()

  if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 404 })

  const person = email.people as any
  if (!person?.company_id) return NextResponse.json({ error: 'No matching person/company for this email' }, { status: 400 })

  const sheetDate = email.received_at.slice(0, 10)

  const result = await parseDriverReply({
    replyText: email.body_text,
    driverEmail: email.from_email,
    sheetDate,
    companyId: person.company_id,
    emailThreadId: email.gmail_thread_id,
  })

  await db.from('email_inbox').update({
    status: result.ok ? 'processed' : 'needs_attention',
    email_type: 'haulage_reply',
    parsed_data: result,
    processed_at: new Date().toISOString(),
    error_message: (result as any).error ?? null,
  }).eq('id', emailInboxId)

  return NextResponse.json(result)
}
