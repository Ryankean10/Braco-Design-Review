ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS person_group text;

CREATE INDEX IF NOT EXISTS people_group_idx ON public.people(person_group);
