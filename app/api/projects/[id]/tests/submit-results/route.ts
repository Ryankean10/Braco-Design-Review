/**
 * External results submission endpoint.
 * Called by the plate load tester app (and future field tools) to push
 * structured results directly into a test record.
 *
 * Auth: Bearer token = Supabase anon key + API key header for extra security.
 * The calling app must pass:
 *   - Header:  x-api-key: <RESULTS_API_KEY env var>
 *   - Body:    { test_ref, results_data, status?, result_summary?, actual_date? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params

  // API key guard — set RESULTS_API_KEY in Vercel env vars
  const apiKey = req.headers.get('x-api-key')
  if (!process.env.RESULTS_API_KEY || apiKey !== process.env.RESULTS_API_KEY) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Use service role to bypass RLS for machine-to-machine writes
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { test_ref, results_data, status, result_summary, actual_date } = body

  if (!test_ref && !body.test_id) {
    return NextResponse.json({ error: 'Provide test_ref or test_id' }, { status: 400 })
  }

  // Find the test record
  let query = supabase.from('test_register').select('id').eq('project_id', projectId)
  if (body.test_id) query = query.eq('id', body.test_id)
  else query = query.eq('test_ref', test_ref)

  const { data: record, error: findErr } = await query.single()
  if (findErr || !record) {
    return NextResponse.json({ error: 'Test record not found' }, { status: 404 })
  }

  const patch: any = {
    results_data,
    results_source: 'plate_load_app',
    updated_at: new Date().toISOString(),
  }
  if (status)         patch.status         = status
  if (result_summary) patch.result_summary = result_summary
  if (actual_date)    patch.actual_date    = actual_date

  const { error: updateErr } = await supabase
    .from('test_register')
    .update(patch)
    .eq('id', record.id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, test_id: record.id })
}
