-- 080: Public timesheet submission + approval workflow

CREATE TABLE IF NOT EXISTS public.timesheet_submissions (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid        REFERENCES public.companies(id) ON DELETE SET NULL,
  company_slug       text        NOT NULL,
  submitted_name     text        NOT NULL,
  matched_person_id  uuid        REFERENCES public.people(id) ON DELETE SET NULL,
  matched_name       text,
  match_confidence   text        CHECK (match_confidence IN ('high', 'medium', 'low', 'unmatched')),
  work_date          date        NOT NULL DEFAULT CURRENT_DATE,
  hours_on_site      numeric(4,2) NOT NULL DEFAULT 0,
  driving_hours      numeric(4,2) NOT NULL DEFAULT 0,
  working_location   text        NOT NULL,
  comments           text,
  status             text        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at        timestamptz,
  rejection_reason   text,
  submitted_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS timesheet_submissions_company_status
  ON public.timesheet_submissions (company_id, status, work_date DESC);

ALTER TABLE public.timesheet_submissions ENABLE ROW LEVEL SECURITY;

-- Admins and PMs can read and manage their company's submissions
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
