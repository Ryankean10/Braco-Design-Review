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

  const {
    submitted_name,
    work_date,
    hours_on_site,
    driving_hours,
    working_location,
    comments,
  } = body

  if (!submitted_name?.trim() || !working_location?.trim()) {
    return NextResponse.json({ error: 'Name and working location are required' }, { status: 400 })
  }

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
    const prompt = `You are matching a submitted name to a list of known team members.

Submitted name: "${submitted_name.trim()}"

Known team members:
${nameListText}

Return a JSON object with:
- "index": 1-based index of the best match, or 0 if no reasonable match
- "confidence": "high" (exact/near-exact match), "medium" (likely same person with abbreviation or slight variation), "low" (possible match but uncertain), or "unmatched" (no plausible match)

Return only the JSON object, no other text.`

    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }],
      })

      const inputTokens = response.usage.input_tokens
      const outputTokens = response.usage.output_tokens
      logApiUsage({ companyId, endpoint: 'timesheet-match', model: MODEL, inputTokens, outputTokens })

      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
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
    work_date: work_date || new Date().toISOString().split('T')[0],
    hours_on_site: parseFloat(hours_on_site) || 0,
    driving_hours: parseFloat(driving_hours) || 0,
    working_location: working_location.trim(),
    comments: comments?.trim() || null,
    status: 'pending',
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, matched: matchConfidence !== 'unmatched', matchedName })
}
