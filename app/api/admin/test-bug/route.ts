import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export async function GET() {
  const results: Record<string, any> = {}

  // 1. Check env vars
  results.env = {
    supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    service_role_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    resend_api_key: !!process.env.RESEND_API_KEY,
    alert_email: process.env.ALERT_EMAIL ?? '(not set, using default)',
    resend_from: process.env.RESEND_FROM_EMAIL ?? '(not set, using default)',
  }

  // 2. Test DB insert
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
    const { data, error } = await sb.from('bug_reports').insert({
      reporter_id: null,
      reporter_name: 'Diagnostic Test',
      reporter_email: 'test@test.com',
      user_message: 'Diagnostic test message',
      summary: 'TEST — diagnostic insert, delete me',
      suggested_actions: [],
      status: 'open',
      report_type: 'bug',
      priority: 'low',
    }).select('id').single()

    if (error) {
      results.db = { ok: false, error: error.message, code: error.code }
    } else {
      results.db = { ok: true, inserted_id: data?.id }
      // Clean up test row
      await sb.from('bug_reports').delete().eq('id', data?.id)
    }
  } catch (e: any) {
    results.db = { ok: false, threw: e?.message }
  }

  // 3. Test Resend
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'MRRK <onboarding@resend.dev>',
        to: process.env.ALERT_EMAIL ?? 'admin@safetconsultancy.co.uk',
        subject: '🔧 MRRK Email Diagnostic Test',
        html: '<p>This is a diagnostic test email from MRRK. If you received this, email sending is working.</p>',
      })
      if (error) {
        results.email = { ok: false, error: JSON.stringify(error) }
      } else {
        results.email = { ok: true, id: data?.id }
      }
    } catch (e: any) {
      results.email = { ok: false, threw: e?.message }
    }
  } else {
    results.email = { ok: false, error: 'RESEND_API_KEY not set' }
  }

  return NextResponse.json(results)
}
