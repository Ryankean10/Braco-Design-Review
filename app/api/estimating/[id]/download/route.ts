import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function gbp(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n)
}
function esc(s: string) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorised', { status: 401 })

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: estimate } = await admin
    .from('estimates')
    .select('*, estimate_items(*), companies(name)')
    .eq('id', id)
    .single()
  if (!estimate) return new NextResponse('Not found', { status: 404 })

  const items = (estimate.estimate_items ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order)
  const sections = [
    { key: 'material', label: 'Materials' },
    { key: 'labour',   label: 'Labour' },
    { key: 'plant',    label: 'Plant' },
    { key: 'other',    label: 'Other' },
  ]

  let grandSubtotal = 0

  const sectionHtml = sections.map(({ key, label }) => {
    const sectionItems = items.filter((i: any) => i.section === key)
    if (!sectionItems.length) return ''
    const sectionTotal = sectionItems.reduce((sum: number, i: any) => {
      return sum + i.total_cost * (1 + (i.markup_pct ?? 15) / 100)
    }, 0)
    grandSubtotal += sectionTotal

    const rows = sectionItems.map((i: any) => {
      const clientUnit  = i.unit_cost  * (1 + (i.markup_pct ?? 15) / 100)
      const clientTotal = i.total_cost * (1 + (i.markup_pct ?? 15) / 100)
      return `<tr>
        <td>${esc(i.description)}${i.notes ? `<br><span class="note">${esc(i.notes)}</span>` : ''}</td>
        <td class="num">${i.quantity}</td>
        <td class="num">${esc(i.unit ?? 'item')}</td>
        <td class="num">${gbp(clientUnit)}</td>
        <td class="num bold">${gbp(clientTotal)}</td>
      </tr>`
    }).join('')

    return `
      <tr class="section-header"><td colspan="5">${label}</td></tr>
      ${rows}
      <tr class="section-total">
        <td colspan="4" class="num">Subtotal — ${label}</td>
        <td class="num">${gbp(sectionTotal)}</td>
      </tr>`
  }).join('')

  const vat       = grandSubtotal * 0.20
  const grandTotal = grandSubtotal + vat
  const companyName = (estimate as any).companies?.name ?? 'Braco'
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(estimate.reference)} — ${esc(estimate.title)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #1a1a2e; background: #fff; padding: 48px; max-width: 860px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; }
  h1 { font-size: 26px; font-weight: 700; }
  .from { font-size: 12px; color: #555; line-height: 1.7; margin-top: 6px; }
  .ref-block { text-align: right; }
  .ref-block .ref { font-size: 20px; font-weight: 700; color: #5b4cf5; }
  .ref-block p { font-size: 12px; color: #555; margin-top: 3px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px; }
  .meta-box { background: #f7f7fb; border-radius: 8px; padding: 14px 18px; }
  .meta-box .label { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #888; margin-bottom: 4px; }
  .meta-box .value { font-weight: 600; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
  th { padding: 9px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #888; border-bottom: 2px solid #e5e5f0; }
  th.num { text-align: right; }
  tr.section-header td { padding: 14px 12px 4px; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: #5b4cf5; border-top: 1px solid #e5e5f0; }
  tbody td { padding: 10px 12px; border-bottom: 1px solid #f0f0f5; vertical-align: top; }
  .note { font-size: 11px; color: #888; }
  td.num { text-align: right; color: #444; }
  td.bold { font-weight: 600; color: #1a1a2e; }
  tr.section-total td { padding: 8px 12px; font-style: italic; font-size: 12px; color: #555; background: #fafafa; }
  .totals-table { margin-top: 24px; }
  .totals-table td { padding: 8px 12px; }
  .totals-table .lbl { text-align: right; color: #555; }
  .totals-table .val { text-align: right; width: 140px; }
  .totals-table .grand td { font-weight: 700; font-size: 16px; border-top: 2px solid #1a1a2e; padding-top: 12px; color: #1a1a2e; }
  .footer { margin-top: 48px; font-size: 11px; color: #aaa; text-align: center; border-top: 1px solid #eee; padding-top: 16px; }
  @media print { body { padding: 24px; } @page { margin: 1.5cm; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>Estimate</h1>
    <p class="from">${esc(companyName)}<br>${esc(estimate.title)}</p>
  </div>
  <div class="ref-block">
    <div class="ref">${esc(estimate.reference)}</div>
    <p>Date: ${dateStr}</p>
    ${estimate.start_date ? `<p>Start: ${estimate.start_date}</p>` : ''}
    ${estimate.end_date ? `<p>End: ${estimate.end_date}</p>` : ''}
  </div>
</div>

<div class="meta-grid">
  <div class="meta-box">
    <div class="label">Prepared by</div>
    <div class="value">${esc(companyName)}</div>
  </div>
  <div class="meta-box">
    <div class="label">Prepared for</div>
    <div class="value">${esc(estimate.client_name ?? '—')}</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Description</th>
      <th class="num">Qty</th>
      <th class="num">Unit</th>
      <th class="num">Unit price</th>
      <th class="num">Total</th>
    </tr>
  </thead>
  <tbody>${sectionHtml}</tbody>
</table>

<table class="totals-table">
  <tr><td class="lbl">Subtotal (ex VAT)</td><td class="val">${gbp(grandSubtotal)}</td></tr>
  <tr><td class="lbl">VAT (20%)</td><td class="val">${gbp(vat)}</td></tr>
  <tr class="grand"><td class="lbl">Total</td><td class="val">${gbp(grandTotal)}</td></tr>
</table>

${estimate.notes ? `<p style="margin-top:24px;font-size:12px;color:#555;"><strong>Notes:</strong> ${esc(estimate.notes)}</p>` : ''}

<div class="footer">This estimate is valid for 30 days from the date of issue.</div>
<script>window.addEventListener('load', () => window.print())</script>
</body>
</html>`

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
