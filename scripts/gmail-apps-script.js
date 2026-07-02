/**
 * Dyce BESS — Daily Email Processor
 *
 * SETUP (one time):
 * 1. Go to https://script.google.com → New Project
 * 2. Paste this entire file
 * 3. Set your webhook URL and secret in the CONFIG block below
 * 4. Run setupTrigger() once (click ▶ Run, select setupTrigger)
 * 5. Approve the Gmail permissions when prompted
 *
 * After that it runs automatically every 30 minutes.
 * Logs visible at: Extensions → Apps Script → Executions
 */

// ── CONFIG ────────────────────────────────────────────────────────────────────
const CONFIG = {
  webhookUrl: 'https://braco-design-review.vercel.app/api/construction/inbound-email',
  webhookSecret: 'dyce-inbound-2026',   // must match INBOUND_EMAIL_SECRET in Vercel env vars
  searchQuery: 'from:stuart.paterson@ocugroup.com subject:(progress) newer_than:2d',
  processedLabel: 'GridGate/Processed',  // Gmail label applied after processing
}
// ─────────────────────────────────────────────────────────────────────────────

function processNewEmails() {
  // Ensure the label exists
  let label = GmailApp.getUserLabelByName(CONFIG.processedLabel)
  if (!label) label = GmailApp.createLabel(CONFIG.processedLabel)

  const threads = GmailApp.search(CONFIG.searchQuery)
  let processed = 0

  for (const thread of threads) {
    const messages = thread.getMessages()
    for (const message of messages) {
      // Skip if already processed
      if (thread.getLabels().some(l => l.getName() === CONFIG.processedLabel)) continue

      const subject = message.getSubject()
      const body = message.getPlainBody()
      const date = message.getDate()

      if (!body || body.trim().length < 50) continue

      try {
        const response = UrlFetchApp.fetch(CONFIG.webhookUrl, {
          method: 'post',
          contentType: 'application/json',
          headers: { 'x-webhook-secret': CONFIG.webhookSecret },
          payload: JSON.stringify({ subject, emailBody: body }),
          muteHttpExceptions: true,
        })

        const code = response.getResponseCode()
        const result = JSON.parse(response.getContentText())

        if (code === 200 && result.success) {
          console.log(`✓ Processed: ${subject} → ${result.log_date}, ${result.personnel} people, ${result.activities_updated} activity updates`)
          thread.addLabel(label)
          processed++
        } else if (result.skipped) {
          console.log(`→ Skipped: ${subject} (${result.reason})`)
          thread.addLabel(label)
        } else {
          console.error(`✗ Error on: ${subject} — HTTP ${code}`, result)
        }
      } catch (e) {
        console.error(`✗ Exception on: ${subject}`, e.toString())
      }
    }
  }

  console.log(`Done. ${processed} emails processed.`)
}

/** Run this once to set up the 30-minute trigger */
function setupTrigger() {
  // Remove any existing triggers for this function
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'processNewEmails')
    .forEach(t => ScriptApp.deleteTrigger(t))

  // Create new trigger: every 30 minutes
  ScriptApp.newTrigger('processNewEmails')
    .timeBased()
    .everyMinutes(30)
    .create()

  console.log('Trigger set up — processNewEmails will run every 30 minutes.')
}

/** Run this to remove the trigger */
function removeTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'processNewEmails')
    .forEach(t => ScriptApp.deleteTrigger(t))
  console.log('Trigger removed.')
}
