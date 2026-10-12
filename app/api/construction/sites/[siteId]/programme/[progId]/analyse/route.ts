import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyseProgramme } from '@/lib/analyseProgramme'
import { requireRole, INTERNAL_ROLES } from '@/lib/auth'

export const maxDuration = 300 // 5 min — requires Vercel Pro, harmless on hobby

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string; progId: string }> }
) {
  const { siteId, progId } = await params
  const auth = await requireRole(INTERNAL_ROLES)
  if ('error' in auth) return auth.error
  const supabase = await createClient()

  // Stream the response so Vercel doesn't cut us off at 60s
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const analysis = await analyseProgramme(siteId, progId)
        controller.enqueue(new TextEncoder().encode(JSON.stringify(analysis)))
      } catch (e: any) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify({ error: e.message ?? 'Analysis failed' })))
      }
      controller.close()
    }
  })

  return new NextResponse(stream, {
    headers: { 'Content-Type': 'application/json' }
  })
}
