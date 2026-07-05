ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS people_active_idx ON public.people(is_active);
