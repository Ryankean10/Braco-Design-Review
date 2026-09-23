import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'
import { logApiUsage } from '@/lib/logApiUsage'

const MODEL = 'claude-sonnet-4-6'

const SYSTEM_PROMPT = `You are a friendly onboarding assistant for Safet Consultancy, an engineering services and design review platform. Your job is to have a natural, warm conversation to understand a potential new client's needs.

Ask these questions one at a time, conversationally — never list them all at once:
1. Their company name and what industry/sector they work in
2. The type of engineering projects they work on (scale, type — e.g. BESS, wind, HV electrical, civils, construction)
3. Their typical challenges with design review, permitting, compliance, or project documentation
4. How many projects they run per year and roughly how many people in their team
5. What they're hoping to get from a platform like this (e.g. faster reviews, compliance tracking, team coordination)
6. Their name, job title, and email address so the team can follow up

Keep responses short — one or two sentences per message. Be warm and professional.

Once you have all six pieces of information, say something like: "Brilliant — that's everything I need. The Safet Consultancy team will be in touch with you shortly." and include the exact token [COMPLETE] at the very end of your final message. Do not include [COMPLETE] in any other message.`

function buildReportHtml(transcript: { role: string; content: string }[], reportText: string): string {
  const lines = reportText.split('\n').map(l => `<p style="margin:4px 0;font-size:14px;color:#374151;">${l || '&nbsp;'}</p>`).join('')
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#f9fafb;padding:32px;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:#1e293b;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:20px;">New Client Enquiry</h1>
      <p style="color:#94a3b8;margin:4px 0 0;font-size:13px;">Submitted via Safet Consultancy onboarding</p>
    </div>
    <div style="padding:28px 32px;">
      ${lines}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
      <p style="font-size:12px;color:#9ca3af;margin:0;">Full conversation transcript attached above.</p>
    </div>
  </div>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  try {
    const { messages, done } = await req.json()

    const client = new Anthropic()

    if (done) {
      // Generate report from transcript
      const reportResp = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: 'You are a report writer. Given a conversation transcript, extract the key information and write a clean summary report. Use plain text with section labels in CAPS followed by a colon.',
        messages: [
          {
            role: 'user',
            content: `Here is an onboarding conversation. Write a summary report with these sections: COMPANY, SECTOR/INDUSTRY, PROJECT TYPES, CHALLENGES, PROJECTS PER YEAR & TEAM SIZE, LOOKING FOR, CONTACT (name / title / email).\n\nThen add a blank line and write FULL TRANSCRIPT: followed by the conversation.\n\nConversation:\n${(messages as any[]).map((m: any) => `${m.role === 'user' ? 'Client' : 'Assistant'}: ${m.content}`).join('\n')}`,
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

      // Extract company name for subject line
      const companyMatch = reportText.match(/COMPANY:\s*(.+)/i)
      const companyName = companyMatch?.[1]?.trim() ?? 'Unknown'

      const resend = new Resend(process.env.RESEND_API_KEY)
      const { error: sendError } = await resend.emails.send({
        from: 'Safet Onboarding <scotplantai@yacht-gitana.com>',
        to: 'admin@safetconsultancy.co.uk',
        subject: `New client enquiry — ${companyName}`,
        html: buildReportHtml(messages, reportText),
        text: reportText,
      })

      if (sendError) {
        console.error('Onboard email failed:', sendError)
        return NextResponse.json({ error: 'Failed to send report' }, { status: 500 })
      }

      return NextResponse.json({ ok: true })
    }

    // Conversation mode
    const anthropicMessages = (messages as any[]).length === 0
      ? []
      : (messages as { role: string; content: string }[]).map(m => ({
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
