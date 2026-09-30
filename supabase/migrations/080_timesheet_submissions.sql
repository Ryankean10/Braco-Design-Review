-- 080: Public timesheet submission + approval workflow
-- Each submission covers a full week (Mon–Sun); per-day data stored in days JSONB

CREATE TABLE IF NOT EXISTS public.timesheet_submissions (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid        REFERENCES public.companies(id) ON DELETE SET NULL,
  company_slug       text        NOT NULL,
  submitted_name     text        NOT NULL,
  matched_person_id  uuid        REFERENCES public.people(id) ON DELETE SET NULL,
  matched_name       text,
  match_confidence   text        CHECK (match_confidence IN ('high', 'medium', 'low', 'unmatched')),
  week_starting      date        NOT NULL,  -- always a Monday
  -- days: [{date, hours_on_site, driving_hours, working_location, comments}]
  days               jsonb       NOT NULL DEFAULT '[]',
  total_hours        numeric(6,2) NOT NULL DEFAULT 0,
  status             text        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at        timestamptz,
  rejection_reason   text,
  submitted_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS timesheet_submissions_company_status
  ON public.timesheet_submissions (company_id, status, week_starting DESC);

ALTER TABLE public.timesheet_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timesheet_company_read" ON public.timesheet_submissions
  FOR SELECT USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR public.is_superadmin()
  );

CREATE POLICY "timesheet_company_write" ON public.timesheet_submissions
  FOR ALL USING (
    (
      company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('admin', 'superadmin', 'project_manager')
      )
    )
    OR public.is_superadmin()
  );
