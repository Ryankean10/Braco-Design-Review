import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // Fetch Dyce benchmark data
  const { data: logs } = await supabase
    .from('site_daily_logs')
    .select('log_date, total_manhours, weather_conditions, weather_lost_hours, personnel')
    .order('log_date', { ascending: true })

  const { data: cables } = await supabase
    .from('cable_items')
    .select('cable_ref, cable_type, length_m, cores, csa_mm2, status, scope_of_work')

  // Build benchmark summary
  const daysWithData = (logs ?? []).filter(l => l.total_manhours && l.total_manhours > 0)
  const totalMH = daysWithData.reduce((s, l) => s + (l.total_manhours ?? 0), 0)
  const avgMHPerDay = totalMH / (daysWithData.length || 1)
  const goodDays = daysWithData.filter(l => l.weather_conditions === 'Good')
  const avgGoodDay = goodDays.length ? goodDays.reduce((s, l) => s + (l.total_manhours ?? 0), 0) / goodDays.length : avgMHPerDay
  const peakCrew = Math.max(...daysWithData.map(l => (l.personnel as { name: string }[] | null)?.length ?? 0))
  const avgCrew = daysWithData.reduce((s, l) => s + ((l.personnel as { name: string }[] | null)?.length ?? 0), 0) / (daysWithData.length || 1)

  const cablesByType: Record<string, { count: number; totalLength: number }> = {}
  for (const c of cables ?? []) {
    const t = c.cable_type ?? 'Unknown'
    if (!cablesByType[t]) cablesByType[t] = { count: 0, totalLength: 0 }
    cablesByType[t].count++
    cablesByType[t].totalLength += c.length_m ?? 0
  }

  const benchmarkSummary = `
DYCE BESS (Braco) — Historical Benchmark Data
Site: 7x MVS battery banks (2 strings per MVS = 14 strings total)
Total cables in scope: ${cables?.length ?? 0}
Site days logged: ${daysWithData.length}
Total manhours: ${totalMH.toFixed(0)}
Average manhours/day: ${avgMHPerDay.toFixed(1)}
Average manhours on Good weather days: ${avgGoodDay.toFixed(1)}
Average crew size: ${avgCrew.toFixed(1)}
Peak crew size: ${peakCrew}

Cable breakdown by type:
${Object.entries(cablesByType).map(([t, v]) => `  ${t}: ${v.count} cables, ${v.totalLength.toFixed(0)}m total`).join('\n')}

Key observations from site:
- AC Battery cables (240mm2): ~252 cables connecting MVS inverters to AC distribution
- 5C Skid cables: 7 cables (one per MVS), inter-skid connections
- String cables (P307-P336): 30 DC string cables per MVS bank
- Site ran largely with 1-2 electricians early phase, scaled to 5-7 for main works
- Typical 10h shift for electricians on site
- Weather delays approx ${((logs ?? []).reduce((s, l) => s + (l.weather_lost_hours ?? 0), 0)).toFixed(0)}h total across all days
`

  const userInput = body

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `You are a BESS (Battery Energy Storage System) construction planner with access to real historical data from the Dyce BESS site in Scotland.
You help plan upcoming BESS projects by benchmarking against actual site experience.
Always give concrete numbers. Be direct and practical. UK context, DNO/NESO terminology.
Format your response as JSON with this structure:
{
  "summary": "2-3 sentence overview",
  "duration_weeks": number,
  "duration_days": number,
  "peak_crew": number,
  "recommended_crew": number,
  "total_manhours": number,
  "phases": [
    {"name": "Phase name", "duration_days": number, "crew": number, "manhours": number, "description": "what happens"}
  ],
  "risks": ["risk 1", "risk 2"],
  "assumptions": ["assumption 1"],
  "benchmark_notes": "how this compares to Dyce"
}`,
    messages: [{
      role: 'user',
      content: `${benchmarkSummary}\n\nNew site to plan:\n${JSON.stringify(userInput, null, 2)}\n\nBased on the Dyce benchmark data above, provide a construction programme forecast for this new site. Return only valid JSON.`
    }]
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const clean = text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  const jsonMatch = clean.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return NextResponse.json({ error: 'Failed to parse forecast' }, { status: 500 })

  let raw = jsonMatch[0]

  // Attempt parse, then progressively repair common Claude JSON issues
  for (const attempt of [
    (s: string) => s,                                           // 1. as-is
    (s: string) => s.replace(/,(\s*[}\]])/g, '$1'),            // 2. trailing commas
    (s: string) => s.replace(/[‘’]/g, "'")           // 3. smart single quotes
                     .replace(/[“”]/g, '"'),
    (s: string) => s.replace(/\n/g, ' ').replace(/\r/g, ''),   // 4. literal newlines in strings
  ]) {
    try {
      return NextResponse.json(JSON.parse(attempt(raw)))
    } catch {
      // try next repair
    }
  }

  console.error('Forecast JSON unrecoverable. Raw:', raw.slice(0, 600))
  return NextResponse.json({ error: 'Forecast response was malformed — please try again' }, { status: 500 })
}
