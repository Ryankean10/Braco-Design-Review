-- Per-project stage template override (null = use company industry default)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS stage_template text;
