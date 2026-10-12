-- 025 — AI analysis columns for uploaded standard documents
ALTER TABLE public.standards
  ADD COLUMN IF NOT EXISTS ai_summary          text,
  ADD COLUMN IF NOT EXISTS ai_key_points       jsonb,   -- array of key clause strings
  ADD COLUMN IF NOT EXISTS ai_bess_applicability text,  -- how this standard applies to BESS projects specifically
  ADD COLUMN IF NOT EXISTS ai_analysed_at      timestamptz;
