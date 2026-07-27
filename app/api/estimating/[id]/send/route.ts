import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

function gbp(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n)
}
function esc(s: string) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { to } = await req.json()
  if (!to) return NextResponse.json({ error: 'to email required' }, { status: 400 })

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: estimate } = await admin
    .from('estimates')
    .select('*, estimate_items(*), companies(name)')
    .eq('id', id)
    .single()
  if (!estimate) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const items = (estimate.estimate_items ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order)
  const sections = [
    { key: 'material', label: 'Materials' },
    { key: 'labour',   label: 'Labour' },
    { key: 'plant',    label: 'Plant' },
    { key: 'other',    label: 'Other' },
  ]

  let grandSubtotal = 0
  const sectionHtml = sections.map(({ key, label }) => {
    const sItems = items.filter((i: any) => i.section === key)
    if (!sItems.length) return ''
    const sTot = sItems.reduce((s: number, i: any) => s + i.total_cost * (1 + (i.markup_pct ?? 15) / 100), 0)
    grandSubtotal += sTot
    const rows = sItems.map((i: any) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f5">${esc(i.description)}</td>
        <td style="padding:8px 12px;text-align:right;border-bottom:1px solid #f0f0f5">${i.quantity}</td>
        <td style="padding:8px 12px;text-align:right;border-bottom:1px solid #f0f0f5">${esc(i.unit ?? 'item')}</td>
        <td style="padding:8px 12px;text-align:right;font-weight:600;border-bottom:1px solid #f0f0f5">${gbp(i.total_cost * (1 + (i.markup_pct ?? 15) / 100))}</td>
      </tr>`).join('')
    return `<tr><td colspan="4" style="padding:14px 12px 4px;font-weight:700;font-size:12px;color:#5b4cf5;text-transform:uppercase">${label}</td></tr>${rows}`
  }).join('')

  const vat = grandSubtotal * 0.20
  const grandTotal = grandSubtotal + vat
  const companyName = (estimate as any).companies?.name ?? 'Braco'
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:32px;color:#1a1a2e">
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px">
  <div>
    <h1 style="font-size:24px;font-weight:700;margin:0">Estimate</h1>
    <p style="font-size:13px;color:#555;margin-top:4px">${esc(companyName)} — ${esc(estimate.title)}</p>
  </div>
  <div style="text-align:right">
    <div style="font-size:18px;font-weight:700;color:#5b4cf5">${esc(estimate.reference)}</div>
    <p style="font-size:12px;color:#555;margin-top:2px">${dateStr}</p>
  </div>
</div>
<div style="background:#f7f7fb;border-radius:8px;padding:14px 18px;margin-bottom:24px">
  <p style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">Prepared for</p>
  <p style="font-weight:600;font-size:15px">${esc(estimate.client_name ?? '—')}</p>
</div>
<table style="width:100%;border-collapse:collapse">
  <thead><tr style="border-bottom:2px solid #e5e5f0">
    <th style="padding:9px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#888">Description</th>
    <th style="padding:9px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#888">Qty</th>
    <th style="padding:9px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#888">Unit</th>
    <th style="padding:9px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#888">Total</th>
  </tr></thead>
  <tbody>${sectionHtml}</tbody>
</table>
<table style="width:100%;border-collapse:collapse;margin-top:20px">
  <tr><td style="padding:7px 12px;text-align:right;color:#555">Subtotal (ex VAT)</td><td style="padding:7px 12px;text-align:right;width:130px">${gbp(grandSubtotal)}</td></tr>
  <tr><td style="padding:7px 12px;text-align:right;color:#555">VAT (20%)</td><td style="padding:7px 12px;text-align:right">${gbp(vat)}</td></tr>
  <tr style="border-top:2px solid #1a1a2e"><td style="padding:10px 12px;text-align:right;font-weight:700;font-size:15px">Total</td><td style="padding:10px 12px;text-align:right;font-weight:700;font-size:15px">${gbp(grandTotal)}</td></tr>
</table>
${estimate.notes ? `<p style="margin-top:20px;font-size:12px;color:#555"><strong>Notes:</strong> ${esc(estimate.notes)}</p>` : ''}
<p style="margin-top:40px;font-size:11px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:14px">This estimate is valid for 30 days. Please reply to this email to accept or discuss.</p>
</body></html>`

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error: emailErr } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'Braco <onboarding@resend.dev>',
    to,
    subject: `Estimate ${estimate.reference} — ${estimate.title}`,
    html,
  })
  if (emailErr) return NextResponse.json({ error: (emailErr as any).message ?? String(emailErr) }, { status: 500 })

  // Mark as sent
  await admin.from('estimates').update({ status: 'sent', updated_at: new Date().toISOString() }).eq('id', id)

  return NextResponse.json({ ok: true })
}
