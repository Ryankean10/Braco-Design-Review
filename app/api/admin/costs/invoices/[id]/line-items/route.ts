import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

async function getAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'superadmin') return null
  return admin
}

// PATCH /api/admin/costs/invoices/[id]/line-items
// Body: { items: [{ id, markup_pct }] }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: invoiceId } = await params
  const admin = await getAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { items } = await req.json()
  if (!Array.isArray(items)) return NextResponse.json({ error: 'items array required' }, { status: 400 })

  for (const item of items) {
    await admin.from('invoice_line_items').update({ markup_pct: item.markup_pct }).eq('id', item.id).eq('invoice_id', invoiceId)
  }

  const { data } = await admin.from('invoice_line_items').select('*').eq('invoice_id', invoiceId)
  return NextResponse.json({ data })
}
