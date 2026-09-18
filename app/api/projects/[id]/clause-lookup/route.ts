import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 30

async function extractPdfText(fileData: Blob): Promise<string> {
  const buf = Buffer.from(await fileData.arrayBuffer())
  const { createRequire } = await import('module')
  const require = createRequire(import.meta.url)
  const pdfParse = require('pdf-parse/lib/pdf-parse.js')
  const parsed = await pdfParse(buf)
  return (parsed.text as string) ?? ''
}

function extractClauseNumber(ref: string): string {
  const match = ref.match(/(\d+(?:\.\d+)+)/)
  return match ? match[1] : ''
}

function isERRef(ref: string): boolean {
  return /^ER\b/i.test(ref.trim()) || /employer.?s\s+req/i.test(ref)
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const ref = req.nextUrl.searchParams.get('ref') ?? ''
    if (!ref) return NextResponse.json({ body: null, source: '' })

    const clauseNum = extractClauseNumber(ref)

    // ── ER reference path ────────────────────────────────────────────────────
    if (isERRef(ref)) {
      // 1. Try er_clauses table
      if (clauseNum) {
        const { data: erClause } = await supabase
          .from('er_clauses')
          .select('clause_ref, heading, body')
          .eq('project_id', projectId)
          .ilike('clause_ref', `%${clauseNum}%`)
          .limit(1)
          .maybeSingle()

        if (erClause?.body) {
          return NextResponse.json({ heading: erClause.heading, body: erClause.body, source: 'ER' })
        }
      }

      // 2. Fall back: search ER PDF text
      const { data: project } = await supabase
        .from('projects')
        .select('er_storage_path')
        .eq('id', projectId)
        .single()

      if (project?.er_storage_path) {
        try {
          const { data: fileData } = await supabase.storage.from('documents').download(project.er_storage_path)
          if (fileData) {
            const text = await extractPdfText(fileData)
            const searchTerm = clauseNum || ref.replace(/^ER\s*/i, '').trim()
            const idx = text.indexOf(searchTerm)
            if (idx !== -1) {
              const start = Math.max(0, idx - 150)
              const end = Math.min(text.length, idx + 900)
              return NextResponse.json({ body: text.slice(start, end).trim(), source: 'ER' })
            }
          }
        } catch { /* fall through */ }
      }

      return NextResponse.json({ body: null, source: 'ER' })
    }

    // ── Standard reference path ──────────────────────────────────────────────
    // Extract the standard identifier prefix: "BS 7671", "IEC 62305", "BS EN 62305-2" etc.
    const stdMatch = ref.match(/^([A-Z]{2,}(?:\s+EN)?\s+\d[\d\-:]*)/i)
    const stdRef = stdMatch ? stdMatch[1].trim() : ref.replace(/\s+(section|clause|part|cl\.?)\s+.*/i, '').trim()

    const { data: standard } = await supabase
      .from('standards')
      .select('id, ref, title, summary')
      .ilike('ref', `%${stdRef.split(' ')[0]}%`)
      .limit(5)

    // Pick best match — prefer exact standard number match
    const std = (standard ?? []).find((s: any) =>
      s.ref.toLowerCase().includes(stdRef.toLowerCase().split(' ')[0])
    ) ?? standard?.[0]

    if (std) {
      if (clauseNum) {
        const { data: clause } = await supabase
          .from('standard_clauses')
          .select('clause_ref, heading, body')
          .eq('standard_id', std.id)
          .ilike('clause_ref', `%${clauseNum}%`)
          .limit(1)
          .maybeSingle()

        if (clause?.body) {
          return NextResponse.json({ heading: clause.heading, body: clause.body, source: std.ref })
        }
      }

      // Fall back to standard summary
      if (std.summary) {
        return NextResponse.json({ heading: std.title, body: std.summary, source: std.ref })
      }
    }

    return NextResponse.json({ body: null, source: ref })
  } catch (e: any) {
    console.error('clause-lookup error:', e)
    return NextResponse.json({ body: null, source: '', error: e.message }, { status: 500 })
  }
}
