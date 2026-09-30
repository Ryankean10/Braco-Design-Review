import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { logApiUsage } from '@/lib/logApiUsage'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const anthropic = new Anthropic()
const MODEL = 'claude-haiku-4-5-20251001'

export async function POST(req: NextRequest) {
  const slug = req.headers.get('x-company-slug') ?? 'unknown'

  const { data: company } = await admin
    .from('companies')
    .select('id')
    .eq('slug', slug)
    .single()
  const companyId: string | null = (company as any)?.id ?? null

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { submitted_name, week_starting, days } = body

  if (!submitted_name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (!week_starting || !Array.isArray(days) || days.length === 0) {
    return NextResponse.json({ error: 'Week and at least one worked day are required' }, { status: 400 })
  }

  // Compute total hours across all submitted days
  const totalHours = days.reduce((s: number, d: any) => s + (parseFloat(d.hours_on_site) || 0), 0)

  // Fetch active people for this company to enable name matching
  const { data: people } = await admin
    .from('people')
    .select('id, name')
    .eq('company_id', companyId)
    .eq('is_active', true)

  const peopleList = (people ?? []) as { id: string; name: string }[]

  let matchedPersonId: string | null = null
  let matchedName: string | null = null
  let matchConfidence: 'high' | 'medium' | 'low' | 'unmatched' = 'unmatched'

  if (peopleList.length > 0) {
    const nameListText = peopleList.map((p, i) => `${i + 1}. ${p.name}`).join('\n')
    const prompt = `You are matching a submitted name to a list of known team members. People often omit middle names, use nicknames, or have slight misspellings. Be generous with matching — it is better to flag a low-confidence match for human review than to leave someone unmatched.

Matching rules:
1. First + last name match with a middle name present in the database = HIGH confidence (e.g. "Ryan Kean" matches "Ryan John Kean")
2. All submitted name parts appear in the known name, ignoring order = HIGH/MEDIUM
3. Minor misspelling of first or last name (1–2 character difference) = MEDIUM
4. Nickname or shortened form of first name (e.g. "Rob" → "Robert", "Mike" → "Michael") = MEDIUM
5. Only one name matches but it is distinctive = LOW
6. No plausible link = UNMATCHED (use this sparingly)

Submitted name: "${submitted_name.trim()}"

Known team members:
${nameListText}

Return ONLY a raw JSON object (no markdown, no explanation):
{"index": <1-based index of best match, or 0 if truly unmatched>, "confidence": "<high|medium|low|unmatched>"}`

    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }],
      })

      logApiUsage({
        companyId,
        endpoint: 'timesheet-match',
        model: MODEL,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      })

      const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
      // Strip markdown code fences that some model responses include
      const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      const parsed = JSON.parse(text)
      const idx: number = parsed.index ?? 0
      const conf: string = parsed.confidence ?? 'unmatched'

      if (idx > 0 && idx <= peopleList.length && conf !== 'unmatched') {
        const person = peopleList[idx - 1]
        matchedPersonId = person.id
        matchedName = person.name
        matchConfidence = conf as 'high' | 'medium' | 'low'
      }
    } catch {
      // Name matching failed — submit as unmatched, don't block the submission
    }
  }

  const { error } = await admin.from('timesheet_submissions').insert({
    company_id: companyId,
    company_slug: slug,
    submitted_name: submitted_name.trim(),
    matched_person_id: matchedPersonId,
    matched_name: matchedName,
    match_confidence: matchConfidence,
    week_starting,
    days,
    total_hours: totalHours,
    status: 'pending',
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, matched: matchConfidence !== 'unmatched', matchedName })
}
