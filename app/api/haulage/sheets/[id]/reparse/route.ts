import { NextRequest, NextResponse } from 'next/server'
import { requireRole, MANAGER_ROLES } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { parseDriverReply } from '@/lib/haulage-parser'

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(MANAGER_ROLES)
  if ('error' in auth) return auth.error
  const { id } = await params
  const db = admin()

  const { data: sheet } = await db
    .from('haulage_daily_sheets')
    .select('*, people(email, company_id)')
    .eq('id', id)
    .single()

  if (!sheet?.raw_reply) return NextResponse.json({ error: 'No reply to reparse' }, { status: 400 })

  const driver = sheet.people as any
  if (!driver?.email || !driver?.company_id) return NextResponse.json({ error: 'Driver data missing' }, { status: 400 })

  const result = await parseDriverReply({
    replyText: sheet.raw_reply,
    driverEmail: driver.email,
    sheetDate: sheet.sheet_date,
    companyId: driver.company_id,
    emailThreadId: sheet.email_thread_id ?? undefined,
  })

  return NextResponse.json(result)
}
