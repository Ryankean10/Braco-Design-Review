import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface ParsedTimesheet {
  type: 'timesheet'
  weekStarting: string // YYYY-MM-DD Monday
  days: {
    date: string
    hoursRegular: number
    hoursOt1: number
    hoursOt2: number
    description: string
  }[]
  notes: string
}

export interface ParsedHoliday {
  type: 'holiday'
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
  description: string
}

export interface ParsedUnknown {
  type: 'unknown'
  reason: string
}

export type ParseResult = ParsedTimesheet | ParsedHoliday | ParsedUnknown

export async function parseEmail(
  subject: string,
  body: string,
  senderEmail: string,
  today: string
): Promise<ParseResult> {
  const prompt = `You are parsing an email sent to a construction company's timesheet inbox.
Today's date: ${today}
Sender email: ${senderEmail}
Subject: ${subject}
Body:
---
${body}
---

Determine if this email is:
1. A TIMESHEET submission — worker reporting their hours for a week
2. A HOLIDAY REQUEST — worker requesting time off
3. UNKNOWN — neither of the above (spam, general query, etc.)

For TIMESHEET: extract the week starting date (always a Monday, YYYY-MM-DD) and hours for each working day (Mon–Fri). Hours fields: hoursRegular (standard hours), hoursOt1 (overtime rate 1), hoursOt2 (overtime rate 2). If the worker just says "10 hours Monday" with no OT split, put all in hoursRegular. Infer the week from context (e.g. "this week", "week ending Friday 25 Jul" → Monday 21 Jul 2025).

IMPORTANT — workers almost always give START and STOP times in 24-hour format, not hours worked. Convert these to decimal hours.
Examples:
  "0700-1400" = 07:00 to 14:00 = 7 hours
  "0700-1700" = 07:00 to 17:00 = 10 hours
  "07:00-15:30" = 8.5 hours
  "0700 to 1800" = 11 hours
  "started 7 finished 3" = 07:00 to 15:00 = 8 hours
Formula: end_hour + end_min/60 - start_hour - start_min/60. Never treat a 4-digit time like "0700" as a plain number.

For HOLIDAY REQUEST: extract startDate and endDate (YYYY-MM-DD). If they say "next week off" calculate from today.

Respond with ONLY valid JSON, no markdown, no explanation:

For timesheet:
{"type":"timesheet","weekStarting":"YYYY-MM-DD","days":[{"date":"YYYY-MM-DD","hoursRegular":8,"hoursOt1":0,"hoursOt2":0,"description":""}],"notes":""}

For holiday:
{"type":"holiday","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","description":""}

For unknown:
{"type":"unknown","reason":"brief reason"}`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

  try {
    // Strip any accidental markdown fences
    const json = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    return JSON.parse(json) as ParseResult
  } catch {
    return { type: 'unknown', reason: `Failed to parse Claude response: ${text.slice(0, 200)}` }
  }
}

// Count working days (Mon–Fri) between two dates inclusive
export function countWorkingDays(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  let count = 0
  const cur = new Date(s)
  while (cur <= e) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}
