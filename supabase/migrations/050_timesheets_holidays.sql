-- Migration 050: Timesheets & Holiday Tracker
-- Run this in Supabase SQL Editor

-- ─── Pay rates + holiday allowance on people ───────────────────────────────
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS standard_rate    numeric(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ot_rate_1        numeric(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ot_rate_2        numeric(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS holiday_allowance integer       DEFAULT 28;

-- ─── Weekly timesheets ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.weekly_timesheets (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id        uuid        NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  company_id       uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  week_starting    date        NOT NULL,
  status           text        NOT NULL DEFAULT 'Draft'
                               CHECK (status IN ('Draft','Submitted','Approved','Rejected')),
  signed_off_by    uuid        REFERENCES auth.users(id),
  signed_off_by_name text,
  signed_off_at    timestamptz,
  sign_off_notes   text,
  sign_off_history jsonb       NOT NULL DEFAULT '[]',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, week_starting)
);

-- ─── Timesheet day entries ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.timesheet_days (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_id   uuid        NOT NULL REFERENCES public.weekly_timesheets(id) ON DELETE CASCADE,
  work_date      date        NOT NULL,
  hours_regular  numeric(5,2) NOT NULL DEFAULT 0,
  hours_ot1      numeric(5,2) NOT NULL DEFAULT 0,
  hours_ot2      numeric(5,2) NOT NULL DEFAULT 0,
  description    text,
  is_holiday     boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (timesheet_id, work_date)
);

-- ─── Holiday bookings ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.holiday_bookings (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id        uuid        NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  company_id       uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  start_date       date        NOT NULL,
  end_date         date        NOT NULL,
  days_taken       integer     NOT NULL DEFAULT 1,
  description      text,
  status           text        NOT NULL DEFAULT 'Pending'
                               CHECK (status IN ('Pending','Approved','Rejected')),
  rejection_note   text,
  approved_by      uuid        REFERENCES auth.users(id),
  approved_by_name text,
  approved_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.weekly_timesheets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheet_days     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holiday_bookings   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ts_company_select" ON public.weekly_timesheets;
DROP POLICY IF EXISTS "ts_company_all"    ON public.weekly_timesheets;
CREATE POLICY "ts_company_select" ON public.weekly_timesheets
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id() OR public.is_superadmin());
CREATE POLICY "ts_company_all" ON public.weekly_timesheets
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id() OR public.is_superadmin())
  WITH CHECK (company_id = public.get_user_company_id() OR public.is_superadmin());

DROP POLICY IF EXISTS "tsdays_company_select" ON public.timesheet_days;
DROP POLICY IF EXISTS "tsdays_company_all"    ON public.timesheet_days;
CREATE POLICY "tsdays_company_select" ON public.timesheet_days
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.weekly_timesheets wt
      WHERE wt.id = timesheet_id
        AND (wt.company_id = public.get_user_company_id() OR public.is_superadmin())
    )
  );
CREATE POLICY "tsdays_company_all" ON public.timesheet_days
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.weekly_timesheets wt
      WHERE wt.id = timesheet_id
        AND (wt.company_id = public.get_user_company_id() OR public.is_superadmin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.weekly_timesheets wt
      WHERE wt.id = timesheet_id
        AND (wt.company_id = public.get_user_company_id() OR public.is_superadmin())
    )
  );

DROP POLICY IF EXISTS "hol_company_select" ON public.holiday_bookings;
DROP POLICY IF EXISTS "hol_company_all"    ON public.holiday_bookings;
CREATE POLICY "hol_company_select" ON public.holiday_bookings
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id() OR public.is_superadmin());
CREATE POLICY "hol_company_all" ON public.holiday_bookings
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id() OR public.is_superadmin())
  WITH CHECK (company_id = public.get_user_company_id() OR public.is_superadmin());

-- ─── Helper: holiday days used in a calendar year ─────────────────────────
CREATE OR REPLACE FUNCTION public.get_holiday_days_used(
  p_person_id uuid,
  p_year      integer
)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(days_taken), 0)::integer
  FROM public.holiday_bookings
  WHERE person_id = p_person_id
    AND status    = 'Approved'
    AND EXTRACT(YEAR FROM start_date) = p_year;
$$;

-- ─── updated_at triggers ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS set_updated_at ON public.weekly_timesheets;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.weekly_timesheets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.timesheet_days;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.timesheet_days
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.holiday_bookings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.holiday_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
