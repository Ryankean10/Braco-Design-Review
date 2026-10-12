import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const admin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

function daysUntil(dateStr: string): number {
  const ms = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)
  return Math.ceil(ms / 86400000)
}

function expiryBadge(days: number): string {
  if (days < 0) return `<span style="color:#ef4444;font-weight:600;">EXPIRED (${Math.abs(days)}d ago)</span>`
  if (days <= 30) return `<span style="color:#ef4444;font-weight:600;">Expires in ${days}d</span>`
  return `<span style="color:#f59e0b;font-weight:600;">Expires in ${days}d</span>`
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().split('T')[0]

  // Fetch all companies with compliance settings
  const { data: settings } = await admin
    .from('company_compliance_settings')
    .select('company_id, warn_days_1, alert_email')

  if (!settings?.length) {
    return NextResponse.json({ ok: true, processed: 0 })
  }

  let processed = 0
  const resend = new Resend(process.env.RESEND_API_KEY)

  for (const setting of settings) {
    const { company_id, warn_days_1, alert_email } = setting

    const warnDate = new Date(Date.now() + warn_days_1 * 86400000).toISOString().split('T')[0]

    // Person credentials expiring within threshold or already expired
    const { data: credentials } = await admin
      .from('person_credentials')
      .select('id, name, expiry_date, category, cert_standard, issuing_client, people!inner(name, company_id)')
      .eq('people.company_id', company_id)
      .not('expiry_date', 'is', null)
      .lte('expiry_date', warnDate)
      .order('expiry_date', { ascending: true })

    // Plant certificates expiring within threshold or already expired
    const { data: plantCerts } = await admin
      .from('plant_certificates')
      .select('id, type, expiry_date, plant_items!inner(name, company_id)')
      .eq('plant_items.company_id', company_id)
      .not('expiry_date', 'is', null)
      .lte('expiry_date', warnDate)
      .order('expiry_date', { ascending: true })

    // Payment milestones overdue
    const { data: overduePayments } = await admin
      .from('payment_milestones')
      .select('id, label, amount, currency, due_date, projects!inner(name)')
      .eq('company_id', company_id)
      .not('due_date', 'is', null)
      .lt('due_date', today)
      .in('status', ['pending', 'invoiced'])
      .order('due_date', { ascending: true })

    const credCount = credentials?.length ?? 0
    const plantCount = plantCerts?.length ?? 0
    const payCount = overduePayments?.length ?? 0

    if (credCount === 0 && plantCount === 0 && payCount === 0) continue

    // Determine recipient — use alert_email or fall back to first admin
    let toEmail = alert_email
    if (!toEmail) {
      const { data: adminProfile } = await admin
        .from('profiles')
        .select('email')
        .eq('company_id', company_id)
        .in('role', ['admin', 'superadmin'])
        .limit(1)
        .single()
      toEmail = adminProfile?.email
    }
    if (!toEmail) continue

    // Build email HTML
    let body = ''

    if (credCount > 0) {
      body += `<h3 style="margin:20px 0 8px;font-size:14px;color:#1e293b;">Person Certifications (${credCount})</h3>`
      body += `<table style="width:100%;border-collapse:collapse;font-size:13px;">`
      body += `<tr style="background:#f1f5f9;"><th style="text-align:left;padding:6px 10px;border:1px solid #e2e8f0;">Person</th><th style="text-align:left;padding:6px 10px;border:1px solid #e2e8f0;">Credential</th><th style="text-align:left;padding:6px 10px;border:1px solid #e2e8f0;">Expiry</th><th style="text-align:left;padding:6px 10px;border:1px solid #e2e8f0;">Status</th></tr>`
      for (const c of credentials ?? []) {
        const days = daysUntil(c.expiry_date)
        const personName = (c as any).people?.name ?? 'Unknown'
        const credLabel = (c as any).cert_standard
          ? `${(c as any).cert_standard}${(c as any).issuing_client ? ` (${(c as any).issuing_client})` : ''}`
          : `${c.name}${c.category ? ` (${c.category})` : ''}`
        body += `<tr><td style="padding:6px 10px;border:1px solid #e2e8f0;">${personName}</td><td style="padding:6px 10px;border:1px solid #e2e8f0;">${credLabel}</td><td style="padding:6px 10px;border:1px solid #e2e8f0;">${c.expiry_date}</td><td style="padding:6px 10px;border:1px solid #e2e8f0;">${expiryBadge(days)}</td></tr>`
      }
      body += `</table>`
    }

    if (plantCount > 0) {
      body += `<h3 style="margin:20px 0 8px;font-size:14px;color:#1e293b;">Plant / Equipment Certificates (${plantCount})</h3>`
      body += `<table style="width:100%;border-collapse:collapse;font-size:13px;">`
      body += `<tr style="background:#f1f5f9;"><th style="text-align:left;padding:6px 10px;border:1px solid #e2e8f0;">Item</th><th style="text-align:left;padding:6px 10px;border:1px solid #e2e8f0;">Type</th><th style="text-align:left;padding:6px 10px;border:1px solid #e2e8f0;">Expiry</th><th style="text-align:left;padding:6px 10px;border:1px solid #e2e8f0;">Status</th></tr>`
      for (const p of plantCerts ?? []) {
        const days = daysUntil(p.expiry_date)
        const itemName = (p as any).plant_items?.name ?? 'Unknown'
        body += `<tr><td style="padding:6px 10px;border:1px solid #e2e8f0;">${itemName}</td><td style="padding:6px 10px;border:1px solid #e2e8f0;">${p.type}</td><td style="padding:6px 10px;border:1px solid #e2e8f0;">${p.expiry_date}</td><td style="padding:6px 10px;border:1px solid #e2e8f0;">${expiryBadge(days)}</td></tr>`
      }
      body += `</table>`
    }

    if (payCount > 0) {
      body += `<h3 style="margin:20px 0 8px;font-size:14px;color:#1e293b;">Overdue Payment Milestones (${payCount})</h3>`
      body += `<table style="width:100%;border-collapse:collapse;font-size:13px;">`
      body += `<tr style="background:#f1f5f9;"><th style="text-align:left;padding:6px 10px;border:1px solid #e2e8f0;">Project</th><th style="text-align:left;padding:6px 10px;border:1px solid #e2e8f0;">Milestone</th><th style="text-align:left;padding:6px 10px;border:1px solid #e2e8f0;">Due</th><th style="text-align:left;padding:6px 10px;border:1px solid #e2e8f0;">Amount</th></tr>`
      for (const pm of overduePayments ?? []) {
        const projectName = (pm as any).projects?.name ?? 'Unknown'
        const amount = pm.amount != null ? `${pm.currency ?? 'GBP'} ${Number(pm.amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : '—'
        body += `<tr><td style="padding:6px 10px;border:1px solid #e2e8f0;">${projectName}</td><td style="padding:6px 10px;border:1px solid #e2e8f0;">${pm.label}</td><td style="padding:6px 10px;border:1px solid #e2e8f0;">${pm.due_date}</td><td style="padding:6px 10px;border:1px solid #e2e8f0;color:#ef4444;font-weight:600;">${amount}</td></tr>`
      }
      body += `</table>`
    }

    const totalAlerts = credCount + plantCount + payCount
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;background:#f9fafb;padding:32px;"><div style="max-width:680px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);"><div style="background:#dc2626;padding:20px 28px;"><h1 style="color:#fff;margin:0;font-size:18px;">Compliance Alert — ${totalAlerts} item${totalAlerts !== 1 ? 's' : ''} require attention</h1><p style="color:#fca5a5;margin:4px 0 0;font-size:13px;">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div><div style="padding:24px 28px;">${body}<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"><p style="font-size:12px;color:#9ca3af;margin:0;">Sent by Safet Consultancy compliance monitoring.</p></div></div></body></html>`

    await resend.emails.send({
      from: 'Safet Compliance <scotplantai@yacht-gitana.com>',
      to: toEmail,
      subject: `Compliance Alert — ${totalAlerts} item${totalAlerts !== 1 ? 's' : ''} require attention`,
      html,
    })

    processed++
  }

  return NextResponse.json({ ok: true, processed })
}
