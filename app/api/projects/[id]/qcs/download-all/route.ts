export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import AdmZip from 'adm-zip'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: project } = await supabase
    .from('projects')
    .select('name')
    .eq('id', projectId)
    .single()

  const { data: docs } = await supabase
    .from('qcs_documents')
    .select('id, title, reference_no, pdf_storage_path, status')
    .eq('project_id', projectId)
    .not('pdf_storage_path', 'is', null)
    .order('reference_no')

  if (!docs || docs.length === 0) {
    return NextResponse.json({ error: 'No QCS documents found' }, { status: 404 })
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const zip = new AdmZip()
  const errors: string[] = []

  for (const doc of docs) {
    if (!doc.pdf_storage_path) continue
    try {
      const { data: fileData, error } = await service.storage
        .from('project-qcs')
        .download(doc.pdf_storage_path)

      if (error || !fileData) {
        errors.push(doc.title)
        continue
      }

      const buf = Buffer.from(await fileData.arrayBuffer())
      // Use the storage filename (last segment of path)
      const filename = doc.pdf_storage_path.split('/').pop() ?? `${doc.reference_no}.docx`
      zip.addFile(filename, buf)
    } catch {
      errors.push(doc.title)
    }
  }

  const zipBuf = zip.toBuffer()
  const safeProjectName = (project?.name ?? 'QCS').replace(/[^a-zA-Z0-9_\- ]/g, '_')
  const zipFilename = `${safeProjectName} - QCS Pack.zip`

  return new NextResponse(zipBuf, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipFilename}"`,
      'Content-Length': zipBuf.length.toString(),
    },
  })
}
