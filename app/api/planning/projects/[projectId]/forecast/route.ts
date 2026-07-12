import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as serviceClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { requireRole, INTERNAL_ROLES } from '@/lib/auth'

export const maxDuration = 300

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

function service() {
  return serviceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params
  const auth = await requireRole(INTERNAL_ROLES)
  if ('error' in auth) return auth.error
  const supabase = await createClient()

  const { data } = await supabase
    .from('work_planner_forecasts')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json(data ?? null)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params
  const auth2 = await requireRole(INTERNAL_ROLES)
  if ('error' in auth2) return auth2.error
  const supabase = await createClient()

  const body = await req.json()
  const { document_ids = [], notes = '' } = body as { document_ids: string[]; notes: string }

  const admin = service()

  // ── 1. Fetch project details ─────────────────────────────────────────────
  const { data: project } = await admin
    .from('projects')
    .select('name, capacity_mw, location, client, stage')
    .eq('id', projectId)
    .single()

  // ── 2. Fetch all benchmarks ──────────────────────────────────────────────
  const { data: benchmarks } = await admin
    .from('project_benchmarks')
    .select('*')
    .order('data_confidence', { ascending: false })

  // ── 3. Fetch long lead library ───────────────────────────────────────────
  const { data: longLeads } = await admin
    .from('long_lead_library')
    .select('*')
    .order('risk_level', { ascending: false })

  // ── 4. Extract text from selected documents ──────────────────────────────
  let docTexts: string[] = []
  if (document_ids.length > 0) {
    const { data: docs } = await admin
      .from('documents')
      .select('id, title, doc_no, storage_path, file_name')
      .in('id', document_ids)

    for (const doc of docs ?? []) {
      try {
        const { data: file } = await admin.storage
          .from('documents')
          .download(doc.storage_path)
        if (!file) continue
        const buf = Buffer.from(await file.arrayBuffer())
        const { default: pdf } = await import('pdf-parse')
        const parsed = await pdf(buf)
        const text = parsed.text.slice(0, 15000)
        docTexts.push(`=== ${doc.title ?? doc.file_name} (${doc.doc_no ?? ''}) ===\n${text}`)
      } catch {
        // skip unreadable docs
      }
    }
  }

  // ── 5. Build prompt ──────────────────────────────────────────────────────
  const benchmarkSummary = (benchmarks ?? []).map(b =>
    `• ${b.site_name}: ${b.capacity_mw}MW, ${b.mvs_count} MVS banks, ${b.region}, ${b.terrain} terrain
   Programme: ${b.total_duration_weeks}w duration, peak crew ${b.peak_crew}, ${b.total_manhours?.toLocaleString()} total manhours
   Manhours by discipline: Civil ${b.civil_hours}h | Electrical ${b.electrical_hours}h | Mechanical ${b.mechanical_hours}h | Comms ${b.commissioning_hours}h | Supervision ${b.supervision_hours}h
   Cost (GBP): Total £${b.total_cost?.toLocaleString()} | Civil £${b.civil_cost?.toLocaleString()} | Electrical £${b.electrical_cost?.toLocaleString()} | Mech £${b.mechanical_cost?.toLocaleString()} | Comms £${b.commissioning_cost?.toLocaleString()}
   Cable qty: AC ${b.ac_battery_cables} | DC ${b.dc_string_cables} | LV ${b.lv_cables} | Comms ${b.comms_cables} | HV ${b.hv_cables}
   Confidence: ${b.data_confidence}. Notes: ${b.source_notes}`
  ).join('\n\n')

  const longLeadSummary = (longLeads ?? []).map(ll =>
    `• ${ll.equipment_type} [${ll.risk_level}]: ${ll.typical_lead_weeks_min}–${ll.typical_lead_weeks_max} weeks. ${ll.notes}`
  ).join('\n')

  const today = new Date().toISOString().split('T')[0]

  const prompt = `You are a BESS construction planning expert. Today is ${today}.

PROJECT DETAILS:
Name: ${project?.name ?? projectId}
Capacity: ${project?.capacity_mw ?? 'unknown'} MW
Location: ${project?.location ?? 'unknown'}
Current stage: ${project?.stage ?? 'Design'}
Additional context: ${notes || 'none'}

BENCHMARK DATA FROM SIMILAR PROJECTS:
${benchmarkSummary}

LONG LEAD ITEM LIBRARY:
${longLeadSummary}

${docTexts.length > 0 ? `PROJECT DOCUMENTS (extracted text):\n${docTexts.join('\n\n')}` : 'No project documents provided — forecast based on project details and benchmarks only.'}

Based on the above, produce a detailed construction work plan forecast. Return ONLY a JSON object with this exact structure:

{
  "summary": "3-4 sentence executive summary of the forecast",
  "confidence": "Low|Medium|High",
  "confidence_note": "brief explanation of confidence level",

  "benchmark_projects": ["site names used as reference"],

  "programme": {
    "total_duration_weeks": number,
    "total_duration_days": number,
    "recommended_start": "YYYY-MM-DD or 'TBC'",
    "phases": [
      {
        "name": "phase name",
        "duration_weeks": number,
        "start_offset_weeks": number,
        "crew": number,
        "manhours": number,
        "description": "what happens in this phase"
      }
    ]
  },

  "manpower": {
    "peak_crew": number,
    "recommended_crew": number,
    "total_manhours": number,
    "by_discipline": [
      { "discipline": "Civil", "hours": number, "percentage": number, "cost_gbp": number },
      { "discipline": "Electrical", "hours": number, "percentage": number, "cost_gbp": number },
      { "discipline": "Mechanical", "hours": number, "percentage": number, "cost_gbp": number },
      { "discipline": "HV / Grid", "hours": number, "percentage": number, "cost_gbp": number },
      { "discipline": "Commissioning", "hours": number, "percentage": number, "cost_gbp": number },
      { "discipline": "Supervision", "hours": number, "percentage": number, "cost_gbp": number }
    ],
    "weekly_profile": [
      { "week": number, "crew": number, "phase": "phase name" }
    ]
  },

  "cost": {
    "total_low_gbp": number,
    "total_mid_gbp": number,
    "total_high_gbp": number,
    "currency": "GBP",
    "basis": "explanation of how cost was derived",
    "by_work_package": [
      { "package": "Civil & Groundworks", "low_gbp": number, "mid_gbp": number, "high_gbp": number },
      { "package": "Electrical Installation", "low_gbp": number, "mid_gbp": number, "high_gbp": number },
      { "package": "Mechanical / Structural", "low_gbp": number, "mid_gbp": number, "high_gbp": number },
      { "package": "HV & Grid Connection", "low_gbp": number, "mid_gbp": number, "high_gbp": number },
      { "package": "Commissioning & Testing", "low_gbp": number, "mid_gbp": number, "high_gbp": number },
      { "package": "Supervision & Management", "low_gbp": number, "mid_gbp": number, "high_gbp": number }
    ]
  },

  "long_lead_items": [
    {
      "item": "equipment name",
      "lead_weeks_min": number,
      "lead_weeks_max": number,
      "risk_level": "Critical|High|Medium|Low",
      "order_by_week": number,
      "notes": "any specific notes for this project"
    }
  ],

  "risks": [
    { "risk": "description", "impact": "High|Medium|Low", "mitigation": "suggested mitigation" }
  ],

  "assumptions": ["assumption string"],

  "analysed_at": "${new Date().toISOString()}"
}

weekly_profile: provide a crew profile for each week of the programme (up to 60 weeks). Keep it realistic — ramp up, peak, ramp down.
long_lead_items: include all Critical and High items from the library plus any project-specific ones. order_by_week = how many weeks before energise the order must be placed.
Scale all numbers to match this project's MW capacity and MVS count relative to the benchmarks.`

  // ── 6. Call Claude ───────────────────────────────────────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const msg = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 8000,
          messages: [{ role: 'user', content: prompt }],
        })

        let raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
        const m = raw.match(/\{[\s\S]*\}/)
        if (m) raw = m[0]

        let forecast: Record<string, unknown>
        try {
          forecast = JSON.parse(raw)
        } catch {
          // attempt basic repair
          raw = raw.replace(/,(\s*[}\]])/g, '$1')
          forecast = JSON.parse(raw)
        }

        // Save to DB
        const { data: saved, error } = await admin
          .from('work_planner_forecasts')
          .insert({
            project_id: projectId,
            forecast,
            document_ids,
            benchmark_ids: (benchmarks ?? []).map(b => b.id),
            created_by: auth2.user.id,
          })
          .select()
          .single()

        if (error) {
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ error: error.message })))
        } else {
          controller.enqueue(new TextEncoder().encode(JSON.stringify(saved)))
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Analysis failed'
        controller.enqueue(new TextEncoder().encode(JSON.stringify({ error: msg })))
      }
      controller.close()
    }
  })

  return new NextResponse(stream, { headers: { 'Content-Type': 'application/json' } })
}
