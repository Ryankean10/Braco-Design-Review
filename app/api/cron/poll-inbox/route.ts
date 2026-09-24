import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { listUnreadMessages, getMessage, markAsRead, applyLabel } from '@/lib/gmail'
import { parseEmail, countWorkingDays } from '@/lib/email-parser'
import { parseDriverReply } from '@/lib/haulage-parser'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const admin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function GET(req: NextRequest) {
  // Verify this is called by Vercel cron or with the cron secret
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const results: string[] = []
  const today = new Date().toISOString().slice(0, 10)

  try {
    const messageIds = await listUnreadMessages(20)
    results.push(`Found ${messageIds.length} unread messages`)

    for (const msgId of messageIds) {
      // Skip if already in DB (unless it was misclassified — haulage replies that hit staff_enquiry first)
      const { data: existing } = await admin
        .from('email_inbox')
        .select('id, email_type')
        .eq('gmail_message_id', msgId)
        .maybeSingle()
      if (existing) {
        // If it was already correctly classified or is a non-haulage type, skip
        if (existing.email_type !== 'staff_enquiry' && existing.email_type !== 'unknown') {
          await markAsRead(msgId); continue
        }
        // Otherwise fall through: a misclassified email may be a haulage reply
        // We'll re-evaluate below and update the existing row if needed
      }

      const msg = await getMessage(msgId)

      // Find matching person by email
      const { data: person } = await admin
        .from('people')
        .select('id, name, email, company_id, standard_rate, ot_rate_1, ot_rate_2, holiday_allowance')
        .eq('email', msg.from)
        .eq('is_active', true)
        .maybeSingle()

      // Insert or reuse existing row
      let inboxRow: { id: string } | null = null
      if (existing) {
        // Re-processing a misclassified email — reuse the existing DB row
        inboxRow = existing
        await admin.from('email_inbox').update({ status: 'processing' }).eq('id', existing.id)
      } else {
        const { data, error: insertErr } = await admin
          .from('email_inbox')
          .insert({
            gmail_message_id: msg.id,
            gmail_thread_id: msg.threadId,
            received_at: msg.date.toISOString(),
            from_email: msg.from,
            from_name: msg.fromName,
            subject: msg.subject,
            body_text: msg.bodyText,
            status: 'processing',
            person_id: person?.id ?? null,
            company_id: person?.company_id ?? null,
          })
          .select()
          .single()
        if (insertErr) { results.push(`Insert error for ${msgId}: ${insertErr.message}`); continue }
        inboxRow = data
      }

      if (!inboxRow) { results.push(`No inbox row for ${msgId}`); continue }

      if (!person) {
        await admin.from('email_inbox').update({
          status: 'failed',
          email_type: 'unknown',
          error_message: `No active person found with email ${msg.from}`,
          processed_at: new Date().toISOString(),
        }).eq('id', inboxRow.id)
        await markAsRead(msgId)
        results.push(`Unknown sender: ${msg.from}`)
        continue
      }

      // ── HAULAGE DRIVER REPLY (check FIRST before general parser) ──
      // Match on subject OR on any email from a driver who has tasks today
      const looksLikeHaulageReply = /re:.*task brief|re:.*daily.*brief|re:.*your tasks/i.test(msg.subject)
      if (person?.company_id) {
        const { data: driverTasks } = await admin
          .from('haulage_tasks')
          .select('id')
          .eq('driver_id', person.id)
          .eq('task_date', today)
          .limit(1)
        const hasTasksToday = (driverTasks?.length ?? 0) > 0
        if (hasTasksToday || looksLikeHaulageReply) {
          results.push(`Haulage check: driver=${person.name}, hasTasksToday=${hasTasksToday}, subjectMatch=${looksLikeHaulageReply}`)
          const result = await parseDriverReply({
            replyText: msg.bodyText,
            driverEmail: msg.from,
            sheetDate: today,
            companyId: person.company_id,
            emailThreadId: msg.threadId,
          })
          await admin.from('email_inbox').update({
            status: result.ok ? 'processed' : 'needs_attention',
            email_type: 'haulage_reply',
            parsed_data: result,
            processed_at: new Date().toISOString(),
            error_message: (result as any).error ?? null,
          }).eq('id', inboxRow.id)
          await applyLabel(msgId, 'Haulage').catch((e) => results.push(`Label error: ${e.message}`))
          await markAsRead(msgId)
          results.push(`Haulage reply from ${person.name}: ${(result as any).lineCount ?? 0} lines, ${ (result as any).hasFlagged ? 'FLAGGED' : (result as any).error ? 'ERROR' : 'OK'}`)
          continue
        }
      }

      // Parse with Claude
      const parsed = await parseEmail(msg.subject, msg.bodyText, msg.from, today)

      if (parsed.type === 'unknown') {
        await admin.from('email_inbox').update({
          status: 'ignored',
          email_type: 'unknown',
          parsed_data: parsed,
          error_message: parsed.reason,
          processed_at: new Date().toISOString(),
        }).eq('id', inboxRow.id)
        await markAsRead(msgId)
        results.push(`Ignored (unknown type) from ${msg.from}: ${parsed.reason}`)
        continue
      }

      // ── TIMESHEET ────────────────────────────────────────────────
      if (parsed.type === 'timesheet') {
        const weekKey = parsed.weekStarting

        // Upsert weekly_timesheets
        const { data: ts } = await admin.from('weekly_timesheets')
          .upsert({
            person_id: person.id,
            company_id: person.company_id,
            week_starting: weekKey,
            status: 'Draft',
            source: 'email',
          }, { onConflict: 'person_id,week_starting', ignoreDuplicates: false })
          .select()
          .single()

        if (ts?.id) {
          // Upsert each day
          for (const day of parsed.days) {
            if (day.hoursRegular === 0 && day.hoursOt1 === 0 && day.hoursOt2 === 0) continue
            await admin.from('timesheet_days').upsert({
              timesheet_id: ts.id,
              work_date: day.date,
              hours_regular: day.hoursRegular,
              hours_ot1: day.hoursOt1,
              hours_ot2: day.hoursOt2,
              description: day.description,
            }, { onConflict: 'timesheet_id,work_date' })
          }

          await admin.from('email_inbox').update({
            status: 'processed',
            email_type: 'timesheet',
            parsed_data: parsed,
            linked_timesheet_id: ts.id,
            processed_at: new Date().toISOString(),
          }).eq('id', inboxRow.id)
          results.push(`Timesheet created for ${person.name} w/c ${weekKey}`)
        }
      }

      // ── HOLIDAY REQUEST ──────────────────────────────────────────
      if (parsed.type === 'holiday') {
        const workingDays = countWorkingDays(parsed.startDate, parsed.endDate)

        const { data: hol } = await admin.from('holiday_bookings')
          .insert({
            person_id: person.id,
            company_id: person.company_id,
            start_date: parsed.startDate,
            end_date: parsed.endDate,
            days_taken: workingDays,
            description: parsed.description,
            status: 'Pending',
            source: 'email',
          })
          .select()
          .single()

        if (hol?.id) {
          await admin.from('email_inbox').update({
            status: 'processed',
            email_type: 'holiday',
            parsed_data: parsed,
            linked_holiday_id: hol.id,
            processed_at: new Date().toISOString(),
          }).eq('id', inboxRow.id)
          results.push(`Holiday request created for ${person.name} ${parsed.startDate}–${parsed.endDate}`)
        }
      }

      // ── STAFF ENQUIRY ────────────────────────────────────────────
      if (parsed.type === 'staff_enquiry') {
        await admin.from('email_inbox').update({
          status: 'needs_attention',
          email_type: 'staff_enquiry',
          parsed_data: parsed,
          processed_at: new Date().toISOString(),
        }).eq('id', inboxRow.id)
        results.push(`Staff enquiry from ${person?.name ?? msg.from}: ${parsed.summary}`)
      }

      // File into the appropriate Gmail label
      const gmailLabel =
        parsed.type === 'timesheet' ? 'Timesheets'
        : parsed.type === 'holiday' ? 'Holidays'
        : parsed.type === 'staff_enquiry' ? 'Staff Enquiries'
        : null
      if (gmailLabel) await applyLabel(msgId, gmailLabel).catch(() => {})

      await markAsRead(msgId)
    }
  } catch (err: any) {
    results.push(`Fatal error: ${err.message}`)
    return NextResponse.json({ ok: false, results }, { status: 500 })
  }

  return NextResponse.json({ ok: true, results })
}
