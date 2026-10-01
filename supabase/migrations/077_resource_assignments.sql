CREATE TABLE IF NOT EXISTS public.resource_assignments (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid         NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  person_id    uuid         NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  project_id   uuid         REFERENCES public.projects(id) ON DELETE CASCADE,
  site_id      uuid         REFERENCES public.construction_sites(id) ON DELETE CASCADE,
  assign_date  date         NOT NULL,
  role_on_day  text,
  notes        text,
  created_by   uuid         REFERENCES auth.users(id),
  created_at   timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT resource_assignments_target CHECK (
    project_id IS NOT NULL OR site_id IS NOT NULL
  )
);

ALTER TABLE public.resource_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resource_assignments_tenant"
  ON public.resource_assignments FOR ALL
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE UNIQUE INDEX IF NOT EXISTS resource_assignments_person_date_project_idx
  ON public.resource_assignments (person_id, assign_date, project_id)
  WHERE project_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS resource_assignments_person_date_site_idx
  ON public.resource_assignments (person_id, assign_date, site_id)
  WHERE site_id IS NOT NULL;
