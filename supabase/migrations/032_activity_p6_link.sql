-- 032 — Add P6 activity cross-reference to construction activities
-- P6 provides the activity schedule driver; ITP provides assurance sign-off
-- These two are cross-referenced per activity to show schedule vs. completion status

ALTER TABLE public.civils_activities
  ADD COLUMN IF NOT EXISTS p6_activity_id   text,
  ADD COLUMN IF NOT EXISTS p6_activity_name text,
  ADD COLUMN IF NOT EXISTS p6_planned_start date,
  ADD COLUMN IF NOT EXISTS p6_planned_finish date,
  ADD COLUMN IF NOT EXISTS qcs_submitted    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS qcs_submitted_at timestamptz;

-- Index for P6 lookups
CREATE INDEX IF NOT EXISTS civils_activities_p6_idx ON public.civils_activities(site_id, p6_activity_id);

COMMENT ON COLUMN public.civils_activities.p6_activity_id   IS 'Primavera P6 activity ID (e.g. A1000)';
COMMENT ON COLUMN public.civils_activities.p6_activity_name IS 'P6 activity description for display';
COMMENT ON COLUMN public.civils_activities.qcs_submitted    IS 'QCS (Quality Control Sheet) submitted and recorded on ITP — sets activity to 100%';
