import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import * as XLSX from 'xlsx'

export const maxDuration = 120

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
    // Prefer sheets whose name looks like "ITP" — send that first and in full
    const itpFirst = [...wb.SheetNames].sort((a, b) => {
      const aItp = /itp/i.test(a) ? 0 : 1
      const bItp = /itp/i.test(b) ? 0 : 1
      return aItp - bItp
    })
    const lines: string[] = []
    for (const sheetName of itpFirst) {
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

  // Load current civils activities before baseline determination
  const { data: currentActivities } = await supabase
    .from('civils_activities')
    .select('id,activity_group,category,status,progress_pct,itp_ref,sort_order')
    .eq('site_id', siteId)
    .order('sort_order')

  const existingBaseline = existing?.find(r => r.is_baseline)
  const baselineHasActivities = (existingBaseline?.ai_activities as any[] | null)?.length ?? 0
  // Re-baseline if: no prior records, prior baseline had 0 activities, or all seeded activities
  // have progress_pct=0 (indicating the first upload produced no completions — allow re-seed with fixes)
  const allZeroProgress = (currentActivities ?? []).length > 0 &&
    (currentActivities ?? []).every(a => a.progress_pct === 0)
  const isFirstRevision = !existing || existing.length === 0 || baselineHasActivities === 0 || allZeroProgress
  const baseline = isFirstRevision ? null : existingBaseline

  // If re-baselining, clear out the old records so we start fresh
  if (isFirstRevision && existing && existing.length > 0) {
    await supabase.from('itp_revisions').delete().eq('site_id', siteId)
    await supabase.from('civils_activities').delete().eq('site_id', siteId)
  }

  // Upload file to storage (non-fatal if bucket missing)
  const storagePath = `itp/${siteId}/${Date.now()}_${file.name}`
  await supabase.storage.from('documents').upload(storagePath, fileBuf, {
    contentType: file.type || 'application/octet-stream', upsert: false,
  })

  // Send raw text to Claude — truncated to 80k chars to stay within token limits.
  // Claude handles structure detection; no fragile column-based pre-filtering.
  // For large Excel files, prefer the ITP sheet content over other sheets.
  const itpSheetStart = rawText.indexOf('=== Sheet:')
  const filteredText = rawText.slice(itpSheetStart >= 0 ? itpSheetStart : 0, 80000)

  // ── Claude analysis ──────────────────────────────────────────────────────
  const baselineContext = baseline
    ? `\nBASELINE ACTIVITIES:\n${JSON.stringify(baseline.ai_activities, null, 2)}\n`
    : ''

  const prompt = `You are analysing an Inspection and Test Plan (ITP) for a UK construction project.

The ITP may be in CSV/spreadsheet format or plain text. Your job is to:
1. Identify the column structure from the header row(s)
2. Extract every unique ACTIVITY GROUP (the highest-level grouping — often column A)
3. Determine completion status for each group by reading the actual data values

DISCIPLINE — look for a discipline/trade code column:
- ECV or "Civils" = "Civils"
- EME or "Electrical" = "Electrical" (includes HV cable, HV switchgear, grid connection)
- T&C, commissioning, energisation items = "Commissioning"
- If no discipline column exists, infer from activity name

COMPLETION — a group is complete when its inspection items show sign-off evidence:
- "Yes" or "Y" in any check/status/completion column
- A date value in any sign-off/witnessed column
- Initials or a name in a signature column
- A group is partially complete if SOME (not all) items are signed
- A group is not started if NO items show sign-off

Extract UNIQUE activity groups only (deduplicated).

For each group return:
- activity_group: exact name/title of the group
- description: one-line summary of what this activity covers
- discipline: "Civils" | "Electrical" | "Commissioning"
- category: Civils only → "Below Ground" (foundations, piling, drainage, ducting, drawpits) or "Above Ground". All others → "N/A"
- itp_ref: document reference number if present, or null
- is_complete: true if all inspection items in the group are signed off
- partial_pct: integer 0-99 if partially signed (e.g. 3 of 7 items = 43), else 0
- completion_evidence: brief note if complete/partial (e.g. "All 5 items signed off", "3/7 items complete"), else null
- sort_order: Civils below ground 1–49, Civils above ground 50–99, Electrical 100–199, Commissioning 200+
${baselineContext}
${baseline ? 'Compare against the baseline and set baseline_status for each.' : ''}

ITP TEXT:
${filteredText}

Return valid JSON only — no markdown fences:
{
  "revision_summary": "string",
  "activities": [
    {
      "activity_group": "string",
      "description": "string",
      "discipline": "Civils" | "Electrical" | "Commissioning",
      "category": "Below Ground" | "Above Ground" | "N/A",
      "itp_ref": "string or null",
      "is_complete": boolean,
      "partial_pct": "integer 0-99 derived from SIGN_OFF ratio when partially signed (e.g. SIGN_OFF:3/7 → 43), else 0",
      "completion_evidence": "string or null",
      "sort_order": number,
      "baseline_status": "new" | "removed" | "completed" | "changed" | "unchanged" | null
    }
  ],
  "diff_summary": { "added": [], "removed": [], "completed": [], "changed": [] }
}`

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
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
        discipline:     a.discipline ?? 'Civils',
        // category only meaningful for Civils; Electrical/Commissioning → 'Above Ground' as neutral default
        category:       (a.discipline === 'Civils') ? (a.category === 'N/A' ? 'Above Ground' : (a.category ?? 'Above Ground')) : 'Above Ground',
        itp_ref:        a.itp_ref ?? null,
        status:         a.is_complete ? 'Complete' : (a.completion_evidence ? 'In Progress' : 'Not Started'),
        progress_pct:   a.is_complete ? 100 : (a.partial_pct ?? 0),
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
          discipline:     a.discipline ?? 'Civils',
          category:       (a.discipline === 'Civils') ? (a.category === 'N/A' ? 'Above Ground' : (a.category ?? 'Above Ground')) : 'Above Ground',
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
