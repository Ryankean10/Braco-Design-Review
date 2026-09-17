ALTER TABLE public.design_findings
  ADD COLUMN IF NOT EXISTS quote                   text,
  ADD COLUMN IF NOT EXISTS designer_response       text,
  ADD COLUMN IF NOT EXISTS designer_responded_at   timestamptz;

ALTER TABLE public.design_review_runs
  ADD COLUMN IF NOT EXISTS markup_html text;
