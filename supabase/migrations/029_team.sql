-- 029 — People library + job appointments

CREATE TABLE IF NOT EXISTS public.people (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  role         text,          -- job title: 'Site Foreman', 'HV Jointer', 'Civils Foreman'
  discipline   text,          -- 'Electrical' | 'Civils' | 'Management' | 'T&C' | 'Other'
  company      text,
  email        text,
  phone        text,
  notes        text,
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.job_appointments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id      uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  project_id     uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  site_id        uuid REFERENCES public.construction_sites(id) ON DELETE CASCADE,
  role_on_job    text,          -- their specific role for this appointment
  is_manager     boolean NOT NULL DEFAULT false,
  appointed_by   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date     date,
  end_date       date,
  notes          text,
  created_at     timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.people           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_appointments ENABLE ROW LEVEL SECURITY;

-- People: anyone authenticated can read the library; admin/engineer/pm can write
CREATE POLICY "people_read"  ON public.people FOR SELECT TO authenticated USING (true);
CREATE POLICY "people_write" ON public.people FOR ALL TO authenticated
  USING  ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','engineer','project_manager'))
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','engineer','project_manager'));

-- Appointments: users only see their own teams
CREATE POLICY "appt_select" ON public.job_appointments FOR SELECT TO authenticated
  USING (appointed_by = auth.uid());
CREATE POLICY "appt_insert" ON public.job_appointments FOR INSERT TO authenticated
  WITH CHECK (appointed_by = auth.uid());
CREATE POLICY "appt_update" ON public.job_appointments FOR UPDATE TO authenticated
  USING (appointed_by = auth.uid()) WITH CHECK (appointed_by = auth.uid());
CREATE POLICY "appt_delete" ON public.job_appointments FOR DELETE TO authenticated
  USING (appointed_by = auth.uid());
