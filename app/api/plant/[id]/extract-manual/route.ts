import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { manual_id } = await req.json()
  if (!manual_id) return NextResponse.json({ error: 'manual_id required' }, { status: 400 })

  const { data: manual } = await supabase.from('plant_manuals').select('*').eq('id', manual_id).single()
  if (!manual) return NextResponse.json({ error: 'Manual not found' }, { status: 404 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  // Download PDF from storage
  const { data: fileData, error: dlError } = await admin.storage.from('plant-manuals').download(manual.storage_path)
  if (dlError || !fileData) return NextResponse.json({ error: 'Could not download manual' }, { status: 500 })

  const buffer = await fileData.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')

  // Send to Claude with PDF content
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        } as any,
        {
          type: 'text',
          text: `You are a maintenance engineer reading a plant/equipment manual. Extract ALL service intervals and maintenance tasks from this manual.

Return a JSON array only — no explanation, no markdown, just the raw JSON array:

[
  {
    "title": "Short task name",
    "description": "What needs to be done",
    "interval_type": "hours|months|weeks|km|annual",
    "interval_value": 250,
    "next_due_date": null
  }
]

interval_type must be one of: hours, months, weeks, km, annual
interval_value is the number (e.g. 250 for every 250 hours, 6 for every 6 months)
Extract every distinct maintenance task — oil changes, filter replacements, inspections, greasing points, belt checks, etc.
If no clear interval is stated, use "annual" with interval_value 1.`,
        },
      ],
    }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  let tasks: any[] = []
  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    tasks = JSON.parse(cleaned)
    if (!Array.isArray(tasks)) tasks = []
  } catch {
    return NextResponse.json({ error: 'AI did not return valid JSON', raw }, { status: 500 })
  }

  // Insert tasks into DB
  const rows = tasks.map((t: any) => ({
    plant_id:       id,
    company_id:     manual.company_id,
    manual_id:      manual_id,
    title:          t.title ?? 'Maintenance task',
    description:    t.description ?? null,
    interval_type:  t.interval_type ?? 'months',
    interval_value: t.interval_value ? parseInt(t.interval_value) : null,
    next_due_date:  t.next_due_date ?? null,
    recurring:      true,
  }))

  const { error: insertError } = await supabase.from('plant_maintenance_tasks').insert(rows)
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 })

  // Mark manual as processed
  await supabase.from('plant_manuals').update({ ai_processed: true, ai_processed_at: new Date().toISOString() }).eq('id', manual_id)

  return NextResponse.json({ count: rows.length })
}
