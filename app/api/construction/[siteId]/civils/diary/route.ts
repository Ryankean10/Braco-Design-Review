import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 120

const serviceSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'engineer', 'project_manager', 'operative'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { siteId } = await params

  let diaryText = ''
  let fileName: string | null = null
  let fileSize: number | null = null
  let storagePath: string | null = null
  let diaryDate = ''

  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    diaryDate = (form.get('diary_date') as string) ?? new Date().toISOString().split('T')[0]
    const rawText = form.get('raw_text') as string | null
    const file = form.get('file') as File | null

    if (file) {
      fileName = file.name
      fileSize = file.size
      const ext = file.name.split('.').pop()?.toLowerCase()
      const path = `civils-diaries/${siteId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`
      storagePath = path

      const bytes = await file.arrayBuffer()
      const buf = Buffer.from(bytes)

      await serviceSupabase().storage.from('documents').upload(path, buf, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

      if (ext === 'pdf') {
        try {
          const { default: pdf } = await import('pdf-parse')
          const result = await pdf(buf)
          diaryText = result.text
        } catch {
          diaryText = rawText ?? ''
        }
      } else {
        diaryText = buf.toString('utf8')
      }
    } else {
      diaryText = rawText ?? ''
    }
  } else {
    const body = await req.json()
    diaryDate = body.diary_date ?? new Date().toISOString().split('T')[0]
    diaryText = body.raw_text ?? ''
    fileName = body.file_name ?? null
  }

  if (!diaryText.trim()) {
    return NextResponse.json({ error: 'No diary content provided' }, { status: 400 })
  }

  // Load current civils activities for context
  const svcDb = serviceSupabase()
  const { data: activities } = await svcDb
    .from('civils_activities')
    .select('id, activity_group, description, category, status, progress_pct')
    .eq('site_id', siteId)
    .order('sort_order')

  const activityList = (activities ?? [])
    .map(a => `- ${a.activity_group} [${a.category}] — current: ${a.status}, ${a.progress_pct}%`)
    .join('\n')

  const prompt = `You are analysing a site diary from a Battery Energy Storage System (BESS) construction project in Scotland. Your job is to extract civils progress information from the diary and update the activity register.

CURRENT CIVILS ACTIVITY REGISTER:
${activityList || '(no activities loaded)'}

SITE DIARY:
Date: ${diaryDate}
${diaryText}

Analyse the diary and return a JSON object with this exact structure:
{
  "ai_summary": "2-3 sentence summary of the day's civils work",
  "ai_weather": "weather conditions if mentioned, else null",
  "ai_crew_count": integer crew count if mentioned, else null,
  "ai_personnel": ["Full Name or initial+surname as written in diary"],
  "ai_activities": [
    {
      "activity_group": "exact name matching the register above",
      "progress_pct": 0-100 integer (your best estimate based on the diary),
      "status": "Not Started|In Progress|Complete|Blocked",
      "note": "brief note on what was done or why blocked"
    }
  ],
  "ai_blockers": [
    {
      "description": "description of the blocker",
      "affects_package": "Electrical|HV Cable|LV Cable|Civils"
    }
  ]
}

Only include activities in ai_activities if the diary explicitly mentions them. Be conservative on progress. For ai_personnel, extract every individual person name mentioned on site that day — include supervisors, operatives, visitors. Write names exactly as they appear. Return valid JSON only.`

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  })

  let parsed: Record<string, unknown> = {}
  const rawResponse = (message.content[0] as { text: string }).text
  try {
    const match = rawResponse.match(/\{[\s\S]*\}/)
    if (match) parsed = JSON.parse(match[0])
  } catch {
    parsed = { ai_summary: rawResponse, ai_activities: [], ai_blockers: [] }
  }

  // Insert diary record
  const { data: diary, error: diaryErr } = await svcDb
    .from('site_diaries')
    .insert({
      site_id: siteId,
      diary_date: diaryDate,
      file_name: fileName,
      storage_path: storagePath,
      file_size: fileSize,
      raw_text: diaryText,
      ai_summary: (parsed.ai_summary as string) ?? null,
      ai_weather: (parsed.ai_weather as string) ?? null,
      ai_crew_count: (parsed.ai_crew_count as number) ?? null,
      ai_activities: parsed.ai_activities ?? [],
      ai_blockers: parsed.ai_blockers ?? [],
      ai_personnel: parsed.ai_personnel ?? [],
      ai_analysed_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (diaryErr) {
    return NextResponse.json({ error: diaryErr.message }, { status: 500 })
  }

  // Apply activity updates
  const activityUpdates = (parsed.ai_activities as Array<{
    activity_group: string; progress_pct: number; status: string; note: string
  }>) ?? []

  const updatedIds: string[] = []
  for (const update of activityUpdates) {
    const match = (activities ?? []).find(a =>
      a.activity_group.toLowerCase() === update.activity_group.toLowerCase()
    )
    if (!match) continue

    // Only update if progress is moving forward (don't regress)
    const newPct = Math.max(match.progress_pct, update.progress_pct ?? 0)
    await svcDb
      .from('civils_activities')
      .update({
        status: update.status ?? match.status,
        progress_pct: newPct,
        progress_note: update.note ?? null,
        last_diary_update: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', match.id)

    updatedIds.push(match.id)
  }

  return NextResponse.json({
    diary,
    updatedActivities: updatedIds.length,
    summary: parsed.ai_summary,
  })
}
