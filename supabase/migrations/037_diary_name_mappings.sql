-- Maps raw diary names (free text) to people library entries, per site
CREATE TABLE IF NOT EXISTS public.diary_name_mappings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id      uuid NOT NULL REFERENCES public.construction_sites(id) ON DELETE CASCADE,
  raw_name     text NOT NULL,
  person_id    uuid REFERENCES public.people(id) ON DELETE SET NULL,
  no_match     boolean NOT NULL DEFAULT false,
  confirmed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  confirmed_at timestamptz DEFAULT now(),
  UNIQUE (site_id, raw_name)
);

CREATE INDEX IF NOT EXISTS dnm_site_idx   ON public.diary_name_mappings(site_id);
CREATE INDEX IF NOT EXISTS dnm_person_idx ON public.diary_name_mappings(person_id);

ALTER TABLE public.diary_name_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth diary_name_mappings" ON public.diary_name_mappings FOR ALL USING (auth.uid() IS NOT NULL);
