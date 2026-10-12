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

function gbp(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n)
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await getAdmin()
  if (!admin) return new NextResponse('Forbidden', { status: 403 })

  const { data: invoice } = await admin
    .from('invoices')
    .select('*, invoice_line_items(*), companies(name)')
    .eq('id', id)
    .single()

  if (!invoice) return new NextResponse('Not found', { status: 404 })

  const items = (invoice.invoice_line_items ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order)
  const subtotal = items.reduce((sum: number, l: any) => {
    const clientTotal = l.total_gbp * (1 + (l.markup_pct ?? 15) / 100)
    return sum + clientTotal
  }, 0)
  const vat = subtotal * 0.20
  const grandTotal = subtotal + vat
  const companyName = (invoice as any).companies?.name ?? 'Client'

  const rows = items.map((l: any) => {
    const clientUnit = l.unit_price_gbp * (1 + (l.markup_pct ?? 15) / 100)
    const clientTotal = l.total_gbp * (1 + (l.markup_pct ?? 15) / 100)
    return `
      <tr>
        <td>${escHtml(l.description)}</td>
        <td class="num">${l.quantity}</td>
        <td class="num">${gbp(clientUnit)}</td>
        <td class="num bold">${gbp(clientTotal)}</td>
      </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escHtml(invoice.invoice_number)} — ${escHtml(companyName)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #1a1a2e; background: #fff; padding: 48px; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 28px; font-weight: 700; color: #1a1a2e; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
  .from { font-size: 12px; color: #555; line-height: 1.6; margin-top: 8px; }
  .invoice-meta { text-align: right; }
  .invoice-meta .num-large { font-size: 22px; font-weight: 700; color: #5b4cf5; }
  .invoice-meta p { font-size: 12px; color: #555; margin-top: 4px; }
  .to-block { background: #f7f7fb; border-radius: 8px; padding: 16px 20px; margin-bottom: 32px; }
  .to-block .label { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #888; margin-bottom: 4px; }
  .to-block .name { font-size: 16px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
  thead tr { border-bottom: 2px solid #e5e5f0; }
  thead th { padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #888; }
  thead th.num { text-align: right; }
  tbody tr { border-bottom: 1px solid #f0f0f5; }
  tbody td { padding: 12px 12px; vertical-align: top; }
  td.num { text-align: right; color: #444; }
  td.bold { font-weight: 600; color: #1a1a2e; }
  .totals { margin-top: 0; border-top: 2px solid #e5e5f0; }
  .totals td { padding: 10px 12px; }
  .totals .label-cell { text-align: right; color: #555; font-size: 13px; }
  .totals .value-cell { text-align: right; font-size: 13px; width: 130px; }
  .totals .grand td { font-weight: 700; font-size: 15px; color: #1a1a2e; border-top: 2px solid #1a1a2e; padding-top: 12px; }
  .footer { margin-top: 48px; font-size: 11px; color: #aaa; text-align: center; border-top: 1px solid #eee; padding-top: 16px; }
  @media print {
    body { padding: 24px; }
    @page { margin: 1.5cm; }
  }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>Invoice</h1>
    <p class="from">Braco Digital Ltd<br>stc.ai.inbox@gmail.com</p>
  </div>
  <div class="invoice-meta">
    <div class="num-large">${escHtml(invoice.invoice_number)}</div>
    <p>Issued: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
    <p>Period: ${invoice.period_start} → ${invoice.period_end}</p>
  </div>
</div>

<div class="to-block">
  <div class="label">Billed to</div>
  <div class="name">${escHtml(companyName)}</div>
</div>

<table>
  <thead>
    <tr>
      <th>Description</th>
      <th class="num">Qty</th>
      <th class="num">Unit price</th>
      <th class="num">Total</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>

<table class="totals">
  <tr>
    <td class="label-cell">Subtotal</td>
    <td class="value-cell">${gbp(subtotal)}</td>
  </tr>
  <tr>
    <td class="label-cell">VAT (20%)</td>
    <td class="value-cell">${gbp(vat)}</td>
  </tr>
  <tr class="grand">
    <td class="label-cell">Total due</td>
    <td class="value-cell">${gbp(grandTotal)}</td>
  </tr>
</table>

<div class="footer">Thank you for your business. Payment terms: 30 days.</div>

<script>window.addEventListener('load', () => window.print())</script>
</body>
</html>`

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

function escHtml(s: string) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
