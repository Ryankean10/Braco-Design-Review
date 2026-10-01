-- ── Estimating module ─────────────────────────────────────────────────────────

CREATE TABLE public.estimates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  title               text NOT NULL,
  description         text,
  client_name         text,
  client_email        text,
  reference           text,
  status              text NOT NULL DEFAULT 'draft', -- draft | sent | accepted | rejected | void
  project_id          uuid,  -- optional link to a project
  start_date          date,
  end_date            date,
  notes               text,
  default_markup_pct  numeric NOT NULL DEFAULT 15,
  created_by          uuid REFERENCES auth.users(id),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE TABLE public.estimate_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id  uuid REFERENCES public.estimates(id) ON DELETE CASCADE,
  section      text NOT NULL,  -- material | labour | plant | other
  description  text NOT NULL,
  quantity     numeric NOT NULL DEFAULT 1,
  unit         text DEFAULT 'item',
  unit_cost    numeric NOT NULL DEFAULT 0,
  total_cost   numeric GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  markup_pct   numeric NOT NULL DEFAULT 15,
  person_id    uuid REFERENCES public.people(id) ON DELETE SET NULL,
  is_hire      boolean DEFAULT false,
  sort_order   integer DEFAULT 0,
  notes        text,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE public.job_library (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text,
  category     text,
  created_by   uuid REFERENCES auth.users(id),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE TABLE public.job_library_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       uuid REFERENCES public.job_library(id) ON DELETE CASCADE,
  section      text NOT NULL,
  description  text NOT NULL,
  quantity     numeric DEFAULT 1,
  unit         text DEFAULT 'item',
  unit_cost    numeric DEFAULT 0,
  sort_order   integer DEFAULT 0,
  notes        text
);

-- RLS
ALTER TABLE public.estimates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_library        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_library_items  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_all" ON public.estimates          FOR ALL USING (is_superadmin());
CREATE POLICY "superadmin_all" ON public.estimate_items     FOR ALL USING (is_superadmin());
CREATE POLICY "superadmin_all" ON public.job_library        FOR ALL USING (is_superadmin());
CREATE POLICY "superadmin_all" ON public.job_library_items  FOR ALL USING (is_superadmin());

CREATE POLICY "company_estimates" ON public.estimates
  FOR ALL USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "company_estimate_items" ON public.estimate_items
  FOR ALL USING (
    estimate_id IN (
      SELECT e.id FROM public.estimates e
      JOIN public.profiles p ON p.company_id = e.company_id
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "company_job_library" ON public.job_library
  FOR ALL USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "company_job_library_items" ON public.job_library_items
  FOR ALL USING (
    job_id IN (
      SELECT jl.id FROM public.job_library jl
      JOIN public.profiles p ON p.company_id = jl.company_id
      WHERE p.id = auth.uid()
    )
  );
