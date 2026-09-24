-- Add personnel extraction to diary
ALTER TABLE public.site_diaries
  ADD COLUMN IF NOT EXISTS ai_personnel jsonb;
-- e.g. ["John Smith", "A. Fraser", "B. Melrose"]

-- Official timesheets uploaded from agency
CREATE TABLE IF NOT EXISTS public.timesheets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid NOT NULL REFERENCES public.construction_sites(id) ON DELETE CASCADE,
  source          text NOT NULL CHECK (source IN ('agency','diary')),
  week_start      date NOT NULL,
  file_name       text,
  storage_path    text,
  raw_text        text,
  notes           text,
  uploaded_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ts_site_idx  ON public.timesheets(site_id);
CREATE INDEX IF NOT EXISTS ts_week_idx  ON public.timesheets(week_start);

-- Individual timesheet entries (one row per person per day)
CREATE TABLE IF NOT EXISTS public.timesheet_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_id    uuid NOT NULL REFERENCES public.timesheets(id) ON DELETE CASCADE,
  site_id         uuid NOT NULL REFERENCES public.construction_sites(id) ON DELETE CASCADE,
  person_name     text NOT NULL,
  person_id       uuid REFERENCES public.people(id) ON DELETE SET NULL,
  entry_date      date NOT NULL,
  hours           numeric(4,1),
  role            text,
  notes           text
);

CREATE INDEX IF NOT EXISTS tse_ts_idx    ON public.timesheet_entries(timesheet_id);
CREATE INDEX IF NOT EXISTS tse_site_idx  ON public.timesheet_entries(site_id);
CREATE INDEX IF NOT EXISTS tse_date_idx  ON public.timesheet_entries(entry_date);
CREATE INDEX IF NOT EXISTS tse_person_idx ON public.timesheet_entries(person_id);

-- RLS
ALTER TABLE public.timesheets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheet_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth timesheets"   ON public.timesheets        FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth ts_entries"   ON public.timesheet_entries FOR ALL USING (auth.uid() IS NOT NULL);
