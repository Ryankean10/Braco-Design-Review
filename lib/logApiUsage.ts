import { createClient as createAdmin } from '@supabase/supabase-js'

// Pricing per million tokens (USD) — update when Anthropic pricing changes
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-8':   { input: 5.00,  output: 25.00 },
  'claude-opus-4-7':   { input: 5.00,  output: 25.00 },
  'claude-opus-4-6':   { input: 5.00,  output: 25.00 },
  'claude-sonnet-4-6': { input: 3.00,  output: 15.00 },
  'claude-haiku-4-5':  { input: 1.00,  output: 5.00  },
  'claude-haiku-3-5':  { input: 0.80,  output: 4.00  },
}

function calcCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] ?? { input: 3.00, output: 15.00 }
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output
}

export async function logApiUsage({
  companyId,
  endpoint,
  model,
  inputTokens,
  outputTokens,
}: {
  companyId: string | null | undefined
  endpoint: string
  model: string
  inputTokens: number
  outputTokens: number
}): Promise<void> {
  try {
    const admin = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
    await admin.from('api_usage_logs').insert({
      company_id:    companyId ?? null,
      endpoint,
      model,
      input_tokens:  inputTokens,
      output_tokens: outputTokens,
      cost_usd:      calcCostUsd(model, inputTokens, outputTokens),
    })
  } catch {
    // Never block the main request — log silently
  }
}
