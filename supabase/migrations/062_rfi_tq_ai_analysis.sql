alter table rfis_tqs
  add column if not exists ai_analysis   jsonb,
  add column if not exists ai_analysed_at timestamptz;
