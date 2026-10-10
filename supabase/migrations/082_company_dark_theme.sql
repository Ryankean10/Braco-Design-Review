-- 082: Per-company dark theme flag + extended brand columns

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS accent_color    text,
  ADD COLUMN IF NOT EXISTS secondary_color text,
  ADD COLUMN IF NOT EXISTS dark_theme      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS industry        text;
