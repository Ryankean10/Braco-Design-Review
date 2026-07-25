import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const USD_TO_GBP = 0.79 // approximate; update as needed

async function getAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'superadmin') return null
  return admin
}

export async function POST(req: NextRequest) {
  const admin = await getAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { company_id, period_start, period_end } = await req.json()
  if (!company_id || !period_start || !period_end) {
    return NextResponse.json({ error: 'company_id, period_start and period_end required' }, { status: 400 })
  }

  // Generate invoice number
  const { count } = await admin.from('invoices').select('*', { count: 'exact', head: true })
  const num = String((count ?? 0) + 1).padStart(4, '0')
  const invoiceNumber = `INV-${new Date().getFullYear()}-${num}`

  // Create invoice
  const { data: invoice, error: invErr } = await admin.from('invoices').insert({
    company_id, invoice_number: invoiceNumber, period_start, period_end, status: 'draft',
  }).select().single()
  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 })

  const lineItems: any[] = []
  let order = 0

  // 1. API usage in period
  const { data: usage } = await admin
    .from('api_usage_logs')
    .select('model, input_tokens, output_tokens, cost_usd')
    .eq('company_id', company_id)
    .gte('created_at', period_start)
    .lte('created_at', period_end + 'T23:59:59Z')

  if (usage?.length) {
    const totalCostGbp = usage.reduce((a, u) => a + u.cost_usd * USD_TO_GBP, 0)
    const totalTokens  = usage.reduce((a, u) => a + u.input_tokens + u.output_tokens, 0)
    lineItems.push({
      invoice_id: invoice.id,
      description: `AI API usage (${(totalTokens / 1000).toFixed(0)}k tokens, ${usage.length} calls)`,
      quantity: 1,
      unit_price_gbp: Math.round(totalCostGbp * 100) / 100,
      sort_order: order++,
    })
  }

  // 2. Time entries in period
  const { data: timeRows } = await admin
    .from('cost_time_entries')
    .select('developer, hours, rate_gbp, description, entry_date')
    .eq('company_id', company_id)
    .gte('entry_date', period_start)
    .lte('entry_date', period_end)

  if (timeRows?.length) {
    const devGroups: Record<string, { hours: number; rate: number }> = {}
    for (const t of timeRows) {
      if (!devGroups[t.developer]) devGroups[t.developer] = { hours: 0, rate: t.rate_gbp }
      devGroups[t.developer].hours += t.hours
    }
    for (const [dev, { hours, rate }] of Object.entries(devGroups)) {
      lineItems.push({
        invoice_id: invoice.id,
        description: `Developer time — ${dev} (${hours}hrs @ £${rate}/hr)`,
        quantity: hours,
        unit_price_gbp: rate,
        sort_order: order++,
      })
    }
  }

  // 3. Hardware costs (amortised share in period or one-off if purchase_date in period)
  const { data: hwRows } = await admin
    .from('cost_hardware')
    .select('name, amount_gbp, purchase_date, amortise_months')
    .eq('company_id', company_id)

  for (const h of hwRows ?? []) {
    if (h.amortise_months) {
      lineItems.push({
        invoice_id: invoice.id,
        description: `Hardware — ${h.name} (amortised 1/${h.amortise_months} months)`,
        quantity: 1,
        unit_price_gbp: Math.round((h.amount_gbp / h.amortise_months) * 100) / 100,
        sort_order: order++,
      })
    } else if (h.purchase_date >= period_start && h.purchase_date <= period_end) {
      lineItems.push({
        invoice_id: invoice.id,
        description: `Hardware — ${h.name}`,
        quantity: 1,
        unit_price_gbp: h.amount_gbp,
        sort_order: order++,
      })
    }
  }

  // 4. Subscription allocations
  const { data: allocRows } = await admin
    .from('cost_subscription_allocations')
    .select('allocation_pct, cost_subscriptions(*)')
    .eq('company_id', company_id)

  for (const a of allocRows ?? []) {
    const sub = (a as any).cost_subscriptions
    if (!sub?.active) continue
    const monthlyAmount = sub.billing_cycle === 'monthly' ? sub.amount_gbp : sub.amount_gbp / 12
    const allocated = monthlyAmount * (a.allocation_pct / 100)
    lineItems.push({
      invoice_id: invoice.id,
      description: `${sub.name} (${a.allocation_pct}% allocation)`,
      quantity: 1,
      unit_price_gbp: Math.round(allocated * 100) / 100,
      sort_order: order++,
    })
  }

  // Insert line items
  if (lineItems.length) {
    await admin.from('invoice_line_items').insert(lineItems)
  }

  // Return full invoice with line items
  const { data: full } = await admin
    .from('invoices')
    .select('*, invoice_line_items(*)')
    .eq('id', invoice.id)
    .single()

  return NextResponse.json({ data: full })
}
