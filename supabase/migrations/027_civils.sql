-- 027 — Civils works module
-- Activity register (populated from ITP parse), site diaries, AI progress interpretation

CREATE TABLE IF NOT EXISTS public.civils_activities (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id             uuid NOT NULL REFERENCES public.construction_sites(id) ON DELETE CASCADE,

  -- Activity identity
  activity_group      text NOT NULL,  -- e.g. 'Pile Cap Foundations', 'Drainage Installation'
  description         text NOT NULL,  -- full description from ITP
  category            text NOT NULL DEFAULT 'Below Ground', -- 'Below Ground' | 'Above Ground'
  itp_ref             text,           -- document ref from ITP col 4
  p6_activity_ref     text,           -- matched P6 activity code if found

  -- Progress (driven by site diaries, not ITP)
  status              text NOT NULL DEFAULT 'Not Started', -- Not Started | In Progress | Complete | Blocked
  progress_pct        int NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  progress_note       text,           -- latest AI-interpreted progress note
  last_diary_update   timestamptz,    -- when a diary last touched this activity

  -- Interface / blocking
  blocks_package      text[],         -- e.g. ['Electrical', 'HV Cable'] — packages this gates
  is_blocker          boolean DEFAULT false,

  -- Ordering
  sort_order          int DEFAULT 0,

  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_diaries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid NOT NULL REFERENCES public.construction_sites(id) ON DELETE CASCADE,

  diary_date      date NOT NULL,
  file_name       text,
  storage_path    text,          -- storage path if uploaded as file
  raw_text        text,          -- manually entered or extracted from file
  file_size       bigint,

  -- AI interpretation output
  ai_summary      text,          -- 2-3 sentence summary of the day
  ai_weather      text,
  ai_crew_count   int,
  ai_activities   jsonb,         -- array of { activity_group, description, progress_pct, note, status }
  ai_blockers     jsonb,         -- array of { description, affects_package }
  ai_analysed_at  timestamptz,

  uploaded_at     timestamptz DEFAULT now(),
  uploaded_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- RLS
ALTER TABLE public.civils_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_diaries       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "civils_read"   ON public.civils_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "civils_write"  ON public.civils_activities FOR ALL TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','engineer','project_manager','operative'))
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','engineer','project_manager','operative'));

CREATE POLICY "diaries_read"  ON public.site_diaries FOR SELECT TO authenticated USING (true);
CREATE POLICY "diaries_write" ON public.site_diaries FOR ALL TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','engineer','project_manager','operative'))
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','engineer','project_manager','operative'));
