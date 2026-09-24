-- 031 — Add discipline column to civils_activities
-- Extends the activity register beyond civils to cover Electrical, HV, Commissioning
-- Electrical activities are seeded from ITP; progress later driven by cable register

ALTER TABLE public.civils_activities
  ADD COLUMN IF NOT EXISTS discipline text NOT NULL DEFAULT 'Civils';

-- Index for filtering by discipline
CREATE INDEX IF NOT EXISTS civils_activities_discipline_idx ON public.civils_activities(site_id, discipline);
