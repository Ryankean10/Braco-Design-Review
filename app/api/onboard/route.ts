import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'
import { logApiUsage } from '@/lib/logApiUsage'

const MODEL = 'claude-sonnet-4-6'

const SYSTEM_PROMPT = `You are an onboarding assistant for Safet Consultancy. You are helping assess whether the Braco platform is a good fit for a potential new client.

The Braco platform serves small engineering, electrical, civils and technical companies. It provides: project stage tracking, site document registers, team/resource management with certification expiry alerts, plant and equipment registers with calibration tracking, a reference library with AI document review, role-based client portals, and (in development) work planning and cost tracking.

Your job is to have a warm, natural conversation — one question at a time — that draws out the specific details needed to assess platform fit. Never list multiple questions at once.

Ask about these areas in order, adapting your language to the conversation:
1. Company name and what sector or industry they operate in
2. Who runs the business — is it one principal, a small team? How many people work for or with them (employees, contractors, subcontractors)?
3. How they operate day-to-day — are they based at one location or mobile across multiple sites? How many projects or jobs do they typically have running at once?
4. The type of work they actually do on projects — commissioning, testing, design review, HV switching, civils supervision, document control, something else?
5. Whether they have compliance or certification requirements — trade authorisations, competency cards, plant calibration certificates, anything with expiry dates they currently track
6. Plant and test equipment — how many items, whether they track calibration, site assignments, or service history
7. How they manage documents today — test records, handover packs, method statements — and what tools they use (SharePoint, Google Drive, Excel, paper)
8. Whether they share documents with clients or main contractors, and how (email attachments, portals, USB sticks)
9. Their biggest admin headaches — what takes up time that shouldn't, what keeps them up at night about compliance or documentation
10. Their name, job title, and email address so the Safet Consultancy team can follow up

Keep each response to one or two short sentences. Be warm, direct, and professional — not chatty or over-long. Show genuine interest in how they work.

Once you have covered all ten areas, end with something like: "That's brilliant — I've got a clear picture of how you work. The Safet Consultancy team will review this and come back to you with a platform fit assessment." Then include the exact token [COMPLETE] at the very end. Do not include [COMPLETE] in any earlier message.`

const PLATFORM_KNOWLEDGE = `The Braco platform currently has these features and their readiness status:

READY NOW:
- Project Stage Tracking: Configurable multi-stage lifecycle (e.g. Preparation → Active → Complete, or a full 6-stage BESS commissioning lifecycle). Each stage has a checklist. Dashboard shows all projects by stage at a glance.
- Site Document Registers: Per-project document store for test records, switching programmes, method statements, commissioning results, photos, certificates. Replaces scattered SharePoint/Google Drive folders.
- Team & Resource Management: People library with roles, certifications, SAP authorisation letters, IPAF cards, trade certs — with configurable expiry alerts (30/60 day warnings). Project assignment tracking.
- Plant Register: Equipment and tool register with calibration certificate uploads, expiry alerts, site assignment tracking. Designed for 10–100 items.
- Reference Library with AI Review: Upload standards, DNO rules, H&S documents, contract templates. AI can review uploaded NEC/JCT contracts for payment terms, unusual clauses, and deviations from standard terms.
- Client/Stakeholder Portal: Role-based access so EPC contractors or end clients can view (not edit) completed test packs and commissioning dossiers. Clean handover without email attachments.
- Project Stage Checklists: Each stage has configurable checklist items — custom checklists can be built for any workflow (HV commissioning, cable testing, civils handover, etc.)

UNDER DEVELOPMENT (weeks away):
- Work Planning / Scheduling: Scheduling individuals across projects, resource calendar
- Estimating & Cost Tracking: Job costing, payment milestone tracking, cashflow alerts

NOT YET BUILT (months of effort):
- Mobile Field Capture → Report Population: Photograph test machine display on phone → auto-populate structured test report. High-value for field engineers.
- AI Contract Review: Upload NEC short form or similar, get plain-English summary of payment terms and flagged clauses.
- Automated Timesheet/Invoice Generation: Generate invoices from logged hours.`

const REPORT_SYSTEM = `You are a platform fit analyst for Safet Consultancy. Given a conversation transcript with a potential client, produce a structured Platform Fit Assessment.

${PLATFORM_KNOWLEDGE}

Write the assessment in this exact format — use plain text, no markdown, section headers in CAPS followed by a colon:

BRACO PLATFORM FIT ASSESSMENT
Company: [Company Name]
Submitted: [today's date]

COMPANY SNAPSHOT:
- Sector: [sector]
- Size: [size / team structure]
- Location(s): [location / operating model]
- Typical projects: [what they do]
- Concurrent projects: [how many at once]

PLATFORM FIT MATRIX:
[List each relevant feature area as: Feature Area | Braco Status | FIT/PARTIAL FIT/NOT YET | Notes]
Use these feature areas where relevant: Project Stage Tracking | Site Document Register | Team & Certification Management | Plant Register | Reference Library & AI Review | Work Planning | Estimating & Cost Tracking | Client Portal
Rate as FIT (ready and directly useful), PARTIAL FIT (ready but needs config, or development version available), or NOT YET (requires significant build).

WHAT WORKS OUT OF THE BOX:
[Bullet list of 4–6 ready features with a one-line explanation of how each fits their specific workflow. Be specific to their situation, not generic.]

CONFIGURATION NEEDED:
[Bullet list of setup steps required before use — e.g. certification warning thresholds, template upload, project stage names, equipment register population]

DEVELOPMENT REQUIRED:
[Only list if they have needs that require new build. Format each as: Feature — description. Effort: High (months) / Medium (weeks) / Low (days). Omit section if nothing applies.]

RECOMMENDED MVP SCOPE:
[Numbered list of 4–5 prioritised items — what to set up first to deliver immediate value. Be specific to their situation.]

NEXT STEPS:
1. [Specific first step]
2. [Specific second step]
3. [Specific third step]

CONTACT:
Name: [name]
Title: [title]
Email: [email]

FULL TRANSCRIPT:
[Paste the full conversation verbatim, prefixed with Client: / Assistant:]`

function buildReportHtml(reportText: string): string {
  const sections = reportText.split('\n')
  let html = ''
  let inMatrix = false
  let matrixRows: string[] = []

  for (const line of sections) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (inMatrix && matrixRows.length > 0) {
        html += renderMatrix(matrixRows)
        matrixRows = []
        inMatrix = false
      }
      html += '<br>'
      continue
    }

    // Section headings
    if (/^[A-Z][A-Z &/]+:/.test(trimmed) && !trimmed.includes('|')) {
      if (inMatrix && matrixRows.length > 0) {
        html += renderMatrix(matrixRows)
        matrixRows = []
        inMatrix = false
      }
      const [head, ...rest] = trimmed.split(':')
      const body = rest.join(':').trim()
      if (head === 'BRACO PLATFORM FIT ASSESSMENT') {
        html += `<h2 style="color:#1e293b;font-size:18px;margin:0 0 4px;">${escHtml(head)}</h2>`
      } else if (head === 'PLATFORM FIT MATRIX') {
        html += `<h3 style="color:#374151;font-size:13px;font-weight:700;margin:20px 0 8px;text-transform:uppercase;letter-spacing:.05em;">${escHtml(head)}</h3>`
        inMatrix = true
      } else if (['WHAT WORKS OUT OF THE BOX', 'CONFIGURATION NEEDED', 'DEVELOPMENT REQUIRED', 'RECOMMENDED MVP SCOPE', 'NEXT STEPS', 'COMPANY SNAPSHOT', 'CONTACT', 'FULL TRANSCRIPT'].includes(head)) {
        html += `<h3 style="color:#374151;font-size:13px;font-weight:700;margin:20px 0 8px;text-transform:uppercase;letter-spacing:.05em;">${escHtml(head)}</h3>`
        if (body) html += `<p style="margin:2px 0;font-size:14px;color:#374151;">${escHtml(body)}</p>`
      } else {
        html += `<p style="margin:4px 0;font-size:14px;color:#374151;"><strong>${escHtml(head)}:</strong> ${escHtml(body)}</p>`
      }
      continue
    }

    // Matrix rows
    if (inMatrix && trimmed.includes('|')) {
      matrixRows.push(trimmed)
      continue
    }

    // Bullet points
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      html += `<p style="margin:2px 0 2px 16px;font-size:14px;color:#374151;">• ${escHtml(trimmed.slice(2))}</p>`
      continue
    }

    // Numbered list
    if (/^\d+\.\s/.test(trimmed)) {
      html += `<p style="margin:2px 0 2px 16px;font-size:14px;color:#374151;">${escHtml(trimmed)}</p>`
      continue
    }

    html += `<p style="margin:4px 0;font-size:14px;color:#374151;">${escHtml(trimmed)}</p>`
  }

  if (inMatrix && matrixRows.length > 0) {
    html += renderMatrix(matrixRows)
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#f9fafb;padding:32px;">
  <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:#1e293b;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:20px;">Platform Fit Assessment</h1>
      <p style="color:#94a3b8;margin:4px 0 0;font-size:13px;">Submitted via Safet Consultancy onboarding — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
    </div>
    <div style="padding:28px 32px;">
      ${html}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
      <p style="font-size:12px;color:#9ca3af;margin:0;">Generated by Safet Consultancy onboarding assistant.</p>
    </div>
  </div>
</body>
</html>`
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function renderMatrix(rows: string[]): string {
  const fitColour: Record<string, string> = {
    'FIT': '#16a34a',
    'PARTIAL FIT': '#d97706',
    'NOT YET': '#dc2626',
  }
  let out = `<table style="width:100%;border-collapse:collapse;font-size:13px;margin:8px 0 16px;">`
  out += `<thead><tr style="background:#f1f5f9;">`
  out += `<th style="text-align:left;padding:8px 10px;border:1px solid #e2e8f0;font-weight:600;color:#374151;">Feature Area</th>`
  out += `<th style="text-align:left;padding:8px 10px;border:1px solid #e2e8f0;font-weight:600;color:#374151;">Braco Status</th>`
  out += `<th style="text-align:center;padding:8px 10px;border:1px solid #e2e8f0;font-weight:600;color:#374151;">Fit</th>`
  out += `<th style="text-align:left;padding:8px 10px;border:1px solid #e2e8f0;font-weight:600;color:#374151;">Notes</th>`
  out += `</tr></thead><tbody>`
  for (const row of rows) {
    const parts = row.split('|').map(p => p.trim()).filter(Boolean)
    if (parts.length < 3) continue
    const [feature, status, fit, ...notesParts] = parts
    const notes = notesParts.join(' | ')
    const colour = fitColour[fit] ?? '#6b7280'
    out += `<tr>`
    out += `<td style="padding:8px 10px;border:1px solid #e2e8f0;color:#1e293b;font-weight:500;">${escHtml(feature ?? '')}</td>`
    out += `<td style="padding:8px 10px;border:1px solid #e2e8f0;color:#374151;">${escHtml(status ?? '')}</td>`
    out += `<td style="padding:8px 10px;border:1px solid #e2e8f0;text-align:center;"><span style="background:${colour};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">${escHtml(fit ?? '')}</span></td>`
    out += `<td style="padding:8px 10px;border:1px solid #e2e8f0;color:#374151;">${escHtml(notes ?? '')}</td>`
    out += `</tr>`
  }
  out += `</tbody></table>`
  return out
}

export async function POST(req: NextRequest) {
  try {
    const { messages, done } = await req.json()

    const client = new Anthropic()

    if (done) {
      const transcript = (messages as any[])
        .map((m: any) => `${m.role === 'user' ? 'Client' : 'Assistant'}: ${m.content}`)
        .join('\n')

      const reportResp = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: REPORT_SYSTEM,
        messages: [
          {
            role: 'user',
            content: `Here is the onboarding conversation. Produce the Platform Fit Assessment now.\n\nConversation:\n${transcript}`,
          },
        ],
      })

      await logApiUsage({
        companyId: null,
        endpoint: 'onboard',
        model: MODEL,
        inputTokens: reportResp.usage.input_tokens,
        outputTokens: reportResp.usage.output_tokens,
      })

      const reportText = reportResp.content[0].type === 'text' ? reportResp.content[0].text : ''

      const companyMatch = reportText.match(/Company:\s*(.+)/i)
      const companyName = companyMatch?.[1]?.trim() ?? 'Unknown'

      const resend = new Resend(process.env.RESEND_API_KEY)
      const { error: sendError } = await resend.emails.send({
        from: 'Safet Onboarding <scotplantai@yacht-gitana.com>',
        to: 'admin@safetconsultancy.co.uk',
        subject: `Platform Fit Assessment — ${companyName}`,
        html: buildReportHtml(reportText),
        text: reportText,
      })

      if (sendError) {
        console.error('Onboard email failed:', sendError)
        return NextResponse.json({ error: 'Failed to send report' }, { status: 500 })
      }

      return NextResponse.json({ ok: true })
    }

    // Conversation mode
    const anthropicMessages = (messages as { role: string; content: string }[]).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: anthropicMessages.length > 0 ? anthropicMessages : [{ role: 'user', content: 'Hello' }],
    })

    await logApiUsage({
      companyId: null,
      endpoint: 'onboard',
      model: MODEL,
      inputTokens: resp.usage.input_tokens,
      outputTokens: resp.usage.output_tokens,
    })

    const message = resp.content[0].type === 'text' ? resp.content[0].text : ''
    const isDone = message.includes('[COMPLETE]')

    return NextResponse.json({ message: message.replace('[COMPLETE]', '').trim(), done: isDone })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}
