-- 050 — Company-level timesheets + holiday tracker for civils companies (SPC)

-- ── Rate & allowance fields on people ────────────────────────────────────────
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS standard_rate   numeric(10,2),
  ADD COLUMN IF NOT EXISTS ot_rate_1       numeric(10,2),
  ADD COLUMN IF NOT EXISTS ot_rate_2       numeric(10,2),
  ADD COLUMN IF NOT EXISTS holiday_allowance integer DEFAULT 28;

-- ── Weekly timesheets ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.weekly_timesheets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id        uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  company_id       uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  week_starting    date NOT NULL,           -- always a Monday
  status           text NOT NULL DEFAULT 'Draft',
                                            -- Draft | Submitted | Approved | Rejected
  -- Current sign-off snapshot
  signed_off_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  signed_off_by_name text,
  signed_off_at    timestamptz,
  sign_off_notes   text,
  -- Immutable audit log: [{action, status, by_id, by_name, at, notes}]
  sign_off_history jsonb NOT NULL DEFAULT '[]',
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  UNIQUE (person_id, week_starting)
);

-- ── Timesheet day entries ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.timesheet_days (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_id   uuid NOT NULL REFERENCES public.weekly_timesheets(id) ON DELETE CASCADE,
  work_date      date NOT NULL,
  hours_regular  numeric(4,1) NOT NULL DEFAULT 0,
  hours_ot1      numeric(4,1) NOT NULL DEFAULT 0,
  hours_ot2      numeric(4,1) NOT NULL DEFAULT 0,
  description    text,
  is_holiday     boolean NOT NULL DEFAULT false,  -- overrides hours; pay = 10h * standard_rate
  created_at     timestamptz DEFAULT now(),
  UNIQUE (timesheet_id, work_date)
);

-- ── Holiday bookings ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.holiday_bookings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id        uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  company_id       uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  start_date       date NOT NULL,
  end_date         date NOT NULL,
  days_taken       integer NOT NULL,          -- working days only (Mon–Fri)
  description      text,
  status           text NOT NULL DEFAULT 'Pending', -- Pending | Approved | Rejected
  rejection_note   text,
  approved_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by_name text,
  approved_at      timestamptz,
  created_at       timestamptz DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.weekly_timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheet_days    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holiday_bookings  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wts_company"  ON public.weekly_timesheets;
DROP POLICY IF EXISTS "td_company"   ON public.timesheet_days;
DROP POLICY IF EXISTS "hb_company"   ON public.holiday_bookings;

CREATE POLICY "wts_company" ON public.weekly_timesheets
  FOR ALL USING (company_id = public.get_user_company_id() OR public.is_superadmin());

-- timesheet_days inherits via join — use company_id on parent
CREATE POLICY "td_company" ON public.timesheet_days
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.weekly_timesheets wt
      WHERE wt.id = timesheet_id
        AND (wt.company_id = public.get_user_company_id() OR public.is_superadmin())
    )
  );

CREATE POLICY "hb_company" ON public.holiday_bookings
  FOR ALL USING (company_id = public.get_user_company_id() OR public.is_superadmin());

-- ── Helper: compute approved holiday days used for a person in a leave year ──
CREATE OR REPLACE FUNCTION public.get_holiday_days_used(
  p_person_id uuid,
  p_year      int
) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(SUM(days_taken), 0)::integer
  FROM   public.holiday_bookings
  WHERE  person_id = p_person_id
    AND  status    = 'Approved'
    AND  EXTRACT(year FROM start_date) = p_year;
$$;
