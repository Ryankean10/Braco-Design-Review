import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const { quoteId } = body

  if (!quoteId) return NextResponse.json({ error: 'quoteId required' }, { status: 400 })

  const { data: quote } = await supabase
    .from('procurement_quotes')
    .select('*, procurement_items(project_id, title)')
    .eq('id', quoteId)
    .single()

  if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  if (!quote.storage_path) return NextResponse.json({ error: 'No document attached to quote' }, { status: 400 })

  // Download quote document
  const { data: fileData } = await supabase.storage.from('documents').download(quote.storage_path)
  if (!fileData) return NextResponse.json({ error: 'Could not download quote document' }, { status: 500 })

  let docText = ''
  try {
    const buf = Buffer.from(await fileData.arrayBuffer())
    if (quote.file_name?.toLowerCase().endsWith('.pdf')) {
      const { createRequire } = await import('module')
      const require = createRequire(import.meta.url)
      const pdfParse = require('pdf-parse/lib/pdf-parse.js')
      const parsed = await pdfParse(buf)
      docText = parsed.text.slice(0, 20000)
    } else {
      // Plain text / email
      docText = buf.toString('utf-8').slice(0, 20000)
    }
  } catch (e: any) {
    return NextResponse.json({ error: `Extraction failed: ${e.message}` }, { status: 500 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `Extract procurement information from this supplier quotation document. The item being quoted is: "${(quote as any).procurement_items?.title ?? 'unknown'}".

Return ONLY valid JSON:
{
  "supplier_name": "company name or null",
  "contact_name": "contact person or null",
  "email": "email address or null",
  "phone": "phone number or null",
  "quote_ref": "quote reference number or null",
  "quote_date": "YYYY-MM-DD or null",
  "validity_date": "YYYY-MM-DD or null",
  "unit_price": number or null,
  "total_price": number or null,
  "currency": "GBP",
  "lead_time_weeks": number or null,
  "notes": "any important caveats, exclusions or conditions"
}

QUOTATION DOCUMENT:
${docText}`
    }]
  })

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

  let extracted: any
  try {
    const stripped = responseText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const jsonMatch = stripped.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found')
    extracted = JSON.parse(jsonMatch[0])
  } catch (e: any) {
    return NextResponse.json({ error: `Parse failed: ${e.message}` }, { status: 500 })
  }

  // Update the quote record
  await supabase.from('procurement_quotes').update({
    supplier_name: extracted.supplier_name ?? quote.supplier_name,
    quote_ref: extracted.quote_ref ?? null,
    quote_date: extracted.quote_date ?? null,
    validity_date: extracted.validity_date ?? null,
    unit_price: extracted.unit_price ?? null,
    total_price: extracted.total_price ?? null,
    currency: extracted.currency ?? 'GBP',
    lead_time_weeks: extracted.lead_time_weeks ?? null,
    notes: extracted.notes ?? null,
    ai_extracted: true,
    ai_raw: responseText,
  }).eq('id', quoteId)

  // Upsert supplier contact if we got enough info
  if (extracted.supplier_name && (extracted.email || extracted.phone)) {
    const { data: existingSupplier } = await supabase
      .from('procurement_suppliers')
      .select('id')
      .ilike('company_name', extracted.supplier_name)
      .single()

    if (!existingSupplier) {
      await supabase.from('procurement_suppliers').insert({
        company_name: extracted.supplier_name,
        contact_name: extracted.contact_name ?? null,
        email: extracted.email ?? null,
        phone: extracted.phone ?? null,
        created_by: user.id,
      })
    }
  }

  return NextResponse.json({ extracted })
}
