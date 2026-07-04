import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import * as XLSX from 'xlsx'

export const config = { api: { bodyParser: false } }
export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

async function extractTextFromBuffer(buf: Buffer, fileName: string): Promise<string> {
  const ext = fileName.split('.').pop()?.toLowerCase()

  if (ext === 'pdf') {
    const pdf = (await import('pdf-parse')).default
    const result = await pdf(buf)
    return result.text
  }
  if (ext === 'docx') {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer: buf })
    return result.value
  }
  if (ext === 'xlsx' || ext === 'xlsb' || ext === 'xls' || ext === 'xlsm') {
    const wb = XLSX.read(buf, { type: 'buffer', cellText: true, cellDates: true })
    const lines: string[] = []
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName]
      const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false })
      if (csv.trim()) {
        lines.push(`=== Sheet: ${sheetName} ===`)
        lines.push(csv)
      }
    }
    return lines.join('\n')
  }
  // Plain text / CSV fallback
  return buf.toString('utf-8')
}

// ── GET: list ITP revisions for a site ──────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data, error } = await supabase
    .from('itp_revisions')
    .select('id,revision,file_name,is_baseline,uploaded_at,analysed_at,diff_summary,ai_activities')
    .eq('site_id', siteId)
    .order('uploaded_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// ── POST: upload + analyse a new ITP revision ────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'engineer', 'project_manager'].includes((profile as any)?.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  const revision = (form.get('revision') as string | null)?.trim() || 'Rev 1'

  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  // Read buffer once — reuse for both extraction and storage
  const fileBuf = Buffer.from(await file.arrayBuffer())

  // Extract text
  let rawText: string
  try {
    rawText = await extractTextFromBuffer(fileBuf, file.name)
  } catch (e: any) {
    return NextResponse.json({ error: `Text extraction failed: ${e.message}` }, { status: 422 })
  }

  // Load existing revisions to determine baseline
  const { data: existing, error: existingErr } = await supabase
    .from('itp_revisions')
    .select('id,revision,is_baseline,ai_activities')
    .eq('site_id', siteId)
    .order('uploaded_at', { ascending: true })

  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 })

  const isFirstRevision = !existing || existing.length === 0
  const baseline = existing?.find(r => r.is_baseline)

  // Load current civils activities for context
  const { data: currentActivities } = await supabase
    .from('civils_activities')
    .select('id,activity_group,category,status,progress_pct,itp_ref,sort_order')
    .eq('site_id', siteId)
    .order('sort_order')

  // Upload file to storage (non-fatal if bucket missing)
  const storagePath = `itp/${siteId}/${Date.now()}_${file.name}`
  await supabase.storage.from('documents').upload(storagePath, fileBuf, {
    contentType: file.type || 'application/octet-stream', upsert: false,
  })

  // ── Claude analysis ──────────────────────────────────────────────────────
  const baselineContext = baseline
    ? `\nBASELINE (${baseline.revision}) CIVILS ACTIVITIES:\n${JSON.stringify(baseline.ai_activities, null, 2)}\n`
    : ''

  const prompt = `You are analysing an Inspection and Test Plan (ITP) for a BESS (Battery Energy Storage System) construction project in the UK.

Your task: extract all CIVILS scope items from this ITP. Ignore electrical, HV/LV cable, commissioning, and instrumentation activities.

Civils scope includes: piling, pile caps, foundations, drainage, cable troughing, drawpits, masonry walls, fencing (acoustic, palisade, chain-link), access roads, concrete pours, groundworks, temporary works, earthing (where structural), CCTV/gate posts.

For each civils item found, identify:
- activity_group: concise name (e.g. "Driven Piles", "Drainage Installation", "North Masonry Wall")
- description: brief scope description from the ITP
- category: "Below Ground" or "Above Ground"
- itp_ref: the ITP reference/row number if visible
- is_complete: true if the ITP shows this item as signed off / inspected / complete (look for tick columns, "Yes", signatures, dates in completion columns)
- completion_evidence: brief note on what indicates completion (or null if not complete)
- sort_order: suggested sort order (below ground first, then above ground)
${baselineContext}
${baseline ? `Compare against the baseline above. For each activity, note if it is:
- "new": not in baseline
- "removed": in baseline but not in this revision
- "completed": was incomplete in baseline, now signed off
- "changed": scope has materially changed
- "unchanged": same as baseline` : ''}

ITP TEXT:
${rawText.slice(0, 12000)}

Return a JSON object:
{
  "revision_summary": "1-2 sentence summary of this ITP revision",
  "activities": [
    {
      "activity_group": "string",
      "description": "string",
      "category": "Below Ground" | "Above Ground",
      "itp_ref": "string or null",
      "is_complete": boolean,
      "completion_evidence": "string or null",
      "sort_order": number,
      "baseline_status": "new" | "removed" | "completed" | "changed" | "unchanged" | null
    }
  ],
  "diff_summary": {
    "added": ["activity names"],
    "removed": ["activity names"],
    "completed": ["activity names"],
    "changed": ["activity names"]
  }
}

Return valid JSON only.`

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  })

  let aiResult: any = { activities: [], diff_summary: { added: [], removed: [], completed: [], changed: [] } }
  try {
    const block = msg.content.find(b => b.type === 'text')
    const match = block && 'text' in block ? block.text.match(/\{[\s\S]*\}/) : null
    if (match) aiResult = JSON.parse(match[0])
  } catch { /* use defaults */ }

  const activities: any[] = aiResult.activities ?? []

  // ── Insert ITP revision record ───────────────────────────────────────────
  const { data: itpRev, error: revErr } = await supabase
    .from('itp_revisions')
    .insert({
      site_id:      siteId,
      revision,
      file_name:    file.name,
      storage_path: storagePath,
      raw_text:     rawText.slice(0, 10000),
      ai_activities: activities,
      is_baseline:  isFirstRevision,
      diff_summary: aiResult.diff_summary ?? null,
      uploaded_by:  user.id,
      analysed_at:  new Date().toISOString(),
    })
    .select('id')
    .single()

  if (revErr) return NextResponse.json({ error: revErr.message }, { status: 500 })

  // ── Seed / update civils_activities ──────────────────────────────────────
  let seeded = 0, updated = 0, completed = 0

  if (isFirstRevision) {
    // First upload: create all activities from scratch
    const toInsert = activities
      .filter(a => a.baseline_status !== 'removed')
      .map((a, i) => ({
        site_id:        siteId,
        activity_group: a.activity_group,
        description:    a.description ?? null,
        category:       a.category ?? 'Above Ground',
        itp_ref:        a.itp_ref ?? null,
        status:         a.is_complete ? 'Complete' : 'Not Started',
        progress_pct:   a.is_complete ? 100 : 0,
        progress_note:  a.completion_evidence ?? null,
        sort_order:     a.sort_order ?? (i + 1),
      }))

    if (toInsert.length > 0) {
      const { error: insErr } = await supabase.from('civils_activities').insert(toInsert)
      if (!insErr) seeded = toInsert.length
    }
  } else {
    // Subsequent revision: update completions + handle structural changes
    for (const a of activities) {
      const existing = (currentActivities ?? []).find(
        x => x.activity_group.toLowerCase() === a.activity_group.toLowerCase()
      )

      if (existing) {
        // Update if newly complete or scope changed
        if (a.is_complete && existing.progress_pct < 100) {
          await supabase.from('civils_activities').update({
            status:        'Complete',
            progress_pct:  100,
            progress_note: a.completion_evidence ?? 'Signed off in ITP',
            itp_ref:       a.itp_ref ?? existing.itp_ref,
          }).eq('id', existing.id)
          completed++
        } else if (a.itp_ref && a.itp_ref !== existing.itp_ref) {
          await supabase.from('civils_activities').update({ itp_ref: a.itp_ref }).eq('id', existing.id)
          updated++
        }
      } else if (a.baseline_status === 'new') {
        // New activity added in this revision
        const maxOrder = (currentActivities ?? []).reduce((m, x) => Math.max(m, x.sort_order ?? 0), 0)
        await supabase.from('civils_activities').insert({
          site_id:        siteId,
          activity_group: a.activity_group,
          description:    a.description ?? null,
          category:       a.category ?? 'Above Ground',
          itp_ref:        a.itp_ref ?? null,
          status:         a.is_complete ? 'Complete' : 'Not Started',
          progress_pct:   a.is_complete ? 100 : 0,
          progress_note:  a.completion_evidence ?? null,
          sort_order:     maxOrder + 1,
        })
        seeded++
      }
    }
  }

  return NextResponse.json({
    itpRevisionId: itpRev.id,
    revision,
    isBaseline: isFirstRevision,
    activitiesSeeded: seeded,
    activitiesCompleted: completed,
    activitiesUpdated: updated,
    diffSummary: aiResult.diff_summary,
    revisionSummary: aiResult.revision_summary,
  })
}
