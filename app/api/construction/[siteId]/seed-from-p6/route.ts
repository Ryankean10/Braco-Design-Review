import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import * as XLSX from 'xlsx'

export const maxDuration = 120

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'engineer', 'project_manager'].includes((profile as any)?.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Get the latest programme file for this site
  const { data: programmes } = await supabase
    .from('construction_programmes')
    .select('id, file_path, file_name, revision')
    .eq('site_id', siteId)
    .order('uploaded_at', { ascending: false })
    .limit(1)

  const prog = programmes?.[0]
  if (!prog) return NextResponse.json({ error: 'No programme uploaded for this site' }, { status: 404 })

  // Check no activities already seeded
  const { count } = await supabase
    .from('civils_activities')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)

  if ((count ?? 0) > 0)
    return NextResponse.json({ error: 'Activities already seeded. Use ITP upload to update.' }, { status: 409 })

  // Fetch file from storage
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: fileData, error: dlErr } = await serviceSupabase.storage
    .from('construction-programmes')
    .download(prog.file_path)

  if (dlErr || !fileData) return NextResponse.json({ error: 'Could not download programme file' }, { status: 500 })

  // Extract text
  const buf = Buffer.from(await fileData.arrayBuffer())
  const ext = prog.file_name.split('.').pop()?.toLowerCase() ?? ''
  let rawText = ''

  if (['xlsx', 'xlsb', 'xls', 'xlsm'].includes(ext)) {
    const wb = XLSX.read(buf, { type: 'buffer', cellText: true })
    const lines: string[] = []
    for (const sheetName of wb.SheetNames) {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName], { blankrows: false })
      if (csv.trim()) lines.push(`=== Sheet: ${sheetName} ===\n${csv}`)
    }
    rawText = lines.join('\n')
  } else {
    rawText = buf.toString('utf-8')
  }

  // Send to Claude to extract activities
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: `You are analysing a P6 programme (activity schedule) for a UK electrical/civils construction project.

Extract every UNIQUE activity from this programme. Group similar sub-tasks under a single parent activity name.

For each activity return:
- activity_group: clear, descriptive activity name (e.g. "132kV Cable Installation", "Compound Formation", "HV Switchgear Installation")
- description: one-line summary
- discipline: "Civils" | "Electrical" | "Commissioning"
  - Civils: groundworks, foundations, drainage, ducting, fencing, access roads, earthing below ground
  - Electrical: cable installation, switchgear, transformers, LV/HV panels, terminations, above-ground earthing
  - Commissioning: testing, commissioning, energisation, protection relay settings, G99, FAT, SAT
- category: Civils only → "Below Ground" or "Above Ground". All others → "N/A"
- is_complete: true only if the programme clearly shows 100% complete
- partial_pct: integer 0-99 if partially complete, else 0
- sort_order: Civils below ground 1–49, Civils above ground 50–99, Electrical 100–199, Commissioning 200+

Ignore header rows, calendar rows, project summary rows, and resource loading rows.
Extract meaningful construction activities only.

PROGRAMME TEXT:
${rawText.slice(0, 80000)}

Return valid JSON only — no markdown fences:
{
  "activities": [
    {
      "activity_group": "string",
      "description": "string",
      "discipline": "Civils" | "Electrical" | "Commissioning",
      "category": "Below Ground" | "Above Ground" | "N/A",
      "is_complete": boolean,
      "partial_pct": number,
      "sort_order": number
    }
  ]
}`,
    }],
  })

  let activities: any[] = []
  try {
    const block = msg.content.find(b => b.type === 'text')
    const match = block && 'text' in block ? block.text.match(/\{[\s\S]*\}/) : null
    if (match) activities = JSON.parse(match[0]).activities ?? []
  } catch { /* use empty */ }

  if (activities.length === 0)
    return NextResponse.json({ error: 'No activities extracted from programme' }, { status: 422 })

  const toInsert = activities.map((a, i) => ({
    site_id:        siteId,
    activity_group: a.activity_group,
    description:    a.description ?? null,
    discipline:     a.discipline ?? 'Civils',
    category:       a.discipline === 'Civils'
      ? (a.category === 'N/A' ? 'Above Ground' : (a.category ?? 'Above Ground'))
      : 'Above Ground',
    itp_ref:        null,
    status:         a.is_complete ? 'Complete' : (a.partial_pct > 0 ? 'In Progress' : 'Not Started'),
    progress_pct:   a.is_complete ? 100 : (a.partial_pct ?? 0),
    progress_note:  a.is_complete ? 'Complete per P6 programme' : null,
    sort_order:     a.sort_order ?? (i + 1),
  }))

  const { error: insErr } = await supabase.from('civils_activities').insert(toInsert)
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  return NextResponse.json({
    seeded: toInsert.length,
    source: `P6 programme: ${prog.revision ?? prog.file_name}`,
  })
}
