import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyseProgramme } from '@/lib/analyseProgramme'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string; progId: string }> }
) {
  const { siteId, progId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const analysis = await analyseProgramme(siteId, progId)
    return NextResponse.json(analysis)
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Analysis failed' }, { status: 500 })
  }
}
