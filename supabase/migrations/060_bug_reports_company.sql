ALTER TABLE public.bug_reports
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bug_reports_company_id_idx ON public.bug_reports(company_id);
