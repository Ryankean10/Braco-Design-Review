export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { parseItpRows, generateQcsPack } from '@/lib/qcs/generateFromItp'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorised' }), { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!['admin', 'engineer'].includes(profile?.role ?? '')) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, client, location')
    .eq('id', projectId)
    .single()

  if (!project) return new Response(JSON.stringify({ error: 'Project not found' }), { status: 404 })

  const { data: itps } = await supabase
    .from('project_itps')
    .select('storage_path, file_name')
    .eq('project_id', projectId)
    .order('uploaded_at', { ascending: false })
    .limit(1)

  if (!itps || itps.length === 0) {
    return new Response(JSON.stringify({ error: 'No ITP uploaded for this project' }), { status: 400 })
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: fileData, error: dlErr } = await service.storage
    .from('documents')
    .download(itps[0].storage_path)

  if (dlErr || !fileData) {
    return new Response(JSON.stringify({ error: `Failed to download ITP: ${dlErr?.message}` }), { status: 500 })
  }

  const itpBuffer = Buffer.from(await fileData.arrayBuffer())
  const rows = parseItpRows(itpBuffer)

  // Stream progress back to client as NDJSON
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: object) {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
      }

      send({ type: 'total', count: rows.length })

      const result = await generateQcsPack(
        itpBuffer,
        { id: project.id, name: project.name, client: project.client ?? '', location: project.location ?? project.name },
        user.id,
        profile?.full_name ?? user.email ?? 'Unknown',
        (current, total, ref, title) => send({ type: 'progress', current, total, ref, title })
      )

      send({ type: 'done', ...result })
      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
      'X-Accel-Buffering': 'no',
    },
  })
}
