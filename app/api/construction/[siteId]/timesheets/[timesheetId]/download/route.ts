import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ siteId: string; timesheetId: string }> }) {
  const { timesheetId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: ts } = await supabase
    .from('timesheets')
    .select('storage_path, file_name')
    .eq('id', timesheetId)
    .single()

  if (!ts?.storage_path) return NextResponse.json({ error: 'No file stored for this timesheet' }, { status: 404 })

  const svc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await svc.storage
    .from('timesheets')
    .createSignedUrl(ts.storage_path, 3600)

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Could not generate URL' }, { status: 500 })

  return NextResponse.json({ url: data.signedUrl, file_name: ts.file_name })
}
