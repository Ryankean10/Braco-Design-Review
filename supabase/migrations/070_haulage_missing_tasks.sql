alter table public.haulage_daily_sheets
  add column if not exists missing_tasks jsonb default null;
