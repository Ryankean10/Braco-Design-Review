CREATE TABLE public.planner_assignments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  person_id    uuid        REFERENCES public.people(id) ON DELETE CASCADE,
  person_label text        NOT NULL,
  date         date        NOT NULL,
  type         text        NOT NULL DEFAULT 'Work'
               CHECK (type IN ('Work','Meeting','Travel','Holiday','Public Holiday','Training','Personal Appointment','Other')),
  client       text,
  scope        text,
  location     text,
  notes        text,
  project_id   uuid        REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX planner_person_date
  ON public.planner_assignments (person_id, date)
  WHERE person_id IS NOT NULL;

CREATE INDEX planner_company_date
  ON public.planner_assignments (company_id, date);

ALTER TABLE public.planner_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planner_company_read" ON public.planner_assignments
  FOR SELECT USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR public.is_superadmin()
  );

CREATE POLICY "planner_company_write" ON public.planner_assignments
  FOR ALL USING (
    (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
     AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()
                 AND role IN ('admin','superadmin','project_manager')))
    OR public.is_superadmin()
  );
