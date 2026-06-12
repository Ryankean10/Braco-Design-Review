import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin','project_manager','engineer'].includes(profile?.role ?? ''))
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single()
  if (!project?.er_storage_path) return NextResponse.json({ error: 'No ER document uploaded' }, { status: 400 })

  // Download + extract ER text
  const { data: fileData } = await supabase.storage.from('documents').download(project.er_storage_path)
  if (!fileData) return NextResponse.json({ error: 'Could not download ER' }, { status: 500 })

  let erText = ''
  try {
    const buf = Buffer.from(await fileData.arrayBuffer())
    const { createRequire } = await import('module')
    const require = createRequire(import.meta.url)
    const pdfParse = require('pdf-parse/lib/pdf-parse.js')
    const parsed = await pdfParse(buf)
    erText = parsed.text.slice(0, 40000)
  } catch (e: any) {
    return NextResponse.json({ error: `PDF extraction failed: ${e.message}` }, { status: 500 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: `You are a UK BESS (Battery Energy Storage System) procurement specialist. Extract all procurable equipment, materials and services from this Employer's Requirements document.

For each item provide realistic UK market lead time estimates based on current supply chain conditions (post-2022).

Return ONLY valid JSON — no other text:
{
  "items": [
    {
      "title": "Item name",
      "description": "Brief description of what is required",
      "category": "one of: BESS Equipment, HV Electrical, LV Electrical, Protection & Control, Transformer, Switchgear, Cables & Containment, Civil & Structural, Mechanical & HVAC, Fire Suppression, Telecoms & SCADA, Other",
      "quantity": null or number,
      "unit": null or "nr/m/m2/set/lot",
      "estimated_lead_weeks": number,
      "lead_time_notes": "brief reason for lead time estimate"
    }
  ]
}

Focus on long-lead and high-value items: transformers, switchgear, BESS containers, inverters, protection relays, HV cables, civil works packages, fire suppression. Omit consumables and minor items.

EMPLOYER'S REQUIREMENTS:
${erText}`
    }]
  })

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

  let result: { items: any[] }
  try {
    const stripped = responseText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const jsonMatch = stripped.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found')
    result = JSON.parse(jsonMatch[0])
    if (!Array.isArray(result.items)) result.items = []
  } catch (e: any) {
    return NextResponse.json({ error: `Parse failed: ${e.message}` }, { status: 500 })
  }

  // Insert items (skip if title already exists for this project)
  const { data: existing } = await supabase
    .from('procurement_items')
    .select('title')
    .eq('project_id', projectId)

  const existingTitles = new Set((existing ?? []).map((r: any) => r.title.toLowerCase()))

  const toInsert = result.items
    .filter(item => item.title && !existingTitles.has(item.title.toLowerCase()))
    .map(item => ({
      project_id: projectId,
      title: item.title,
      description: item.description ?? null,
      category: item.category ?? 'Other',
      quantity: item.quantity ?? null,
      unit: item.unit ?? null,
      estimated_lead_weeks: item.estimated_lead_weeks ?? null,
      notes: item.lead_time_notes ?? null,
      er_extracted: true,
      created_by: user.id,
    }))

  if (toInsert.length) {
    await supabase.from('procurement_items').insert(toInsert)
  }

  return NextResponse.json({ inserted: toInsert.length, skipped: result.items.length - toInsert.length })
}
