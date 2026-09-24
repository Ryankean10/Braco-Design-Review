-- ────────────────────────────────────────────────────────────────────────────
-- 024 — Work Planner: benchmarks, long-lead library, saved forecasts
-- ────────────────────────────────────────────────────────────────────────────

-- Historical benchmark data from completed/in-progress BESS projects
CREATE TABLE IF NOT EXISTS public.project_benchmarks (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name             text NOT NULL,
  capacity_mw           numeric,
  mvs_count             int,
  site_area_ha          numeric,
  region                text,
  connection_type       text DEFAULT 'distribution', -- distribution | transmission
  terrain               text DEFAULT 'standard',     -- standard | rural | remote | coastal

  -- Programme actuals
  total_duration_weeks  numeric,
  peak_crew             int,
  total_manhours        int,

  -- Manhours by discipline
  civil_hours           int,
  electrical_hours      int,
  mechanical_hours      int,
  commissioning_hours   int,
  supervision_hours     int,
  hv_hours              int,

  -- Cable quantities (number of circuits/cables, not metres)
  ac_battery_cables     int,
  dc_string_cables      int,
  lv_cables             int,
  comms_cables          int,
  hv_cables             int,

  -- Cost actuals/estimates (GBP)
  total_cost            numeric,
  civil_cost            numeric,
  electrical_cost       numeric,
  mechanical_cost       numeric,
  commissioning_cost    numeric,
  supervision_cost      numeric,

  -- Metadata
  project_id            uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  source_notes          text,
  data_confidence       text DEFAULT 'estimated', -- estimated | partial | actual
  created_at            timestamptz DEFAULT now(),
  created_by            uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Long lead item library — grows over time from project experience
CREATE TABLE IF NOT EXISTS public.long_lead_library (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_type          text NOT NULL,
  description             text,
  typical_lead_weeks_min  int NOT NULL,
  typical_lead_weeks_max  int NOT NULL,
  typical_lead_weeks_avg  int GENERATED ALWAYS AS ((typical_lead_weeks_min + typical_lead_weeks_max) / 2) STORED,
  risk_level              text DEFAULT 'Medium',  -- Low | Medium | High | Critical
  supplier_region         text DEFAULT 'UK/EU',
  notes                   text,
  source_projects         text[],
  last_updated            timestamptz DEFAULT now(),
  created_at              timestamptz DEFAULT now()
);

-- AI-generated forecasts saved per project
CREATE TABLE IF NOT EXISTS public.work_planner_forecasts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  forecast        jsonb NOT NULL,           -- full AI output
  document_ids    uuid[] DEFAULT '{}',      -- which project docs were used
  benchmark_ids   uuid[] DEFAULT '{}',      -- which benchmarks were referenced
  status          text DEFAULT 'draft',     -- draft | confirmed
  confirmed_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  confirmed_at    timestamptz,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- RLS
ALTER TABLE public.project_benchmarks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.long_lead_library     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_planner_forecasts ENABLE ROW LEVEL SECURITY;

-- Benchmarks: read for all authenticated, write for admin/engineer/pm
CREATE POLICY "benchmarks_read"  ON public.project_benchmarks    FOR SELECT TO authenticated USING (true);
CREATE POLICY "benchmarks_write" ON public.project_benchmarks    FOR ALL    TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','engineer','project_manager'))
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','engineer','project_manager'));

CREATE POLICY "long_lead_read"   ON public.long_lead_library     FOR SELECT TO authenticated USING (true);
CREATE POLICY "long_lead_write"  ON public.long_lead_library     FOR ALL    TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','engineer'))
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','engineer'));

CREATE POLICY "forecast_read"    ON public.work_planner_forecasts FOR SELECT TO authenticated USING (true);
CREATE POLICY "forecast_write"   ON public.work_planner_forecasts FOR ALL    TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','engineer','project_manager'))
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','engineer','project_manager'));
