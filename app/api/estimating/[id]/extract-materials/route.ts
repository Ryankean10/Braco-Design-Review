import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { extractAndParse } from '@/lib/repairJson'
import { logApiUsage } from '@/lib/logApiUsage'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function auth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: profile } = await admin.from('profiles').select('role, company_id').eq('id', user.id).single()
  if (!profile) return null
  return { admin, profile, supabase, userId: user.id }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: estimateId } = await params
  const ctx = await auth()
  if (!ctx) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())
  let docText = ''

  const name = file.name.toLowerCase()
  try {
    if (name.endsWith('.pdf')) {
      const { createRequire } = await import('module')
      const require = createRequire(import.meta.url)
      const pdfParse = require('pdf-parse/lib/pdf-parse.js')
      const parsed = await pdfParse(buf)
      docText = parsed.text.slice(0, 30000)
    } else if (name.endsWith('.docx') || name.endsWith('.doc')) {
      const mammoth = (await import('mammoth')).default
      const result = await mammoth.extractRawText({ buffer: buf })
      docText = result.value.slice(0, 30000)
    } else {
      docText = buf.toString('utf-8').slice(0, 30000)
    }
  } catch (e: any) {
    return NextResponse.json({ error: `Could not read file: ${e.message}` }, { status: 500 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `Extract all line items from this supplier quote / materials list. For each item return a JSON array with objects having these exact keys:
- "description": string — item name/description
- "quantity": number — quantity (default 1 if not stated)
- "unit": string — unit of measure (e.g. "m", "m2", "nr", "item", "kg", "tonne", "hrs")
- "unit_cost": number — unit price in GBP (omit currency symbols)
- "notes": string or null — any relevant notes/caveats

Return ONLY a valid JSON array, nothing else. If the document is not a quote or you cannot extract items, return [].

DOCUMENT:
${docText}`,
    }],
  })
  logApiUsage({ companyId: ctx.profile.company_id, endpoint: 'extract-materials', model: message.model, inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens }).catch(() => {})

  const text = message.content[0].type === 'text' ? message.content[0].text : '[]'
  let items: any[]
  try {
    items = extractAndParse(text)
    if (!Array.isArray(items)) items = []
  } catch {
    items = []
  }

  return NextResponse.json({ items })
}
