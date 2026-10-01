-- 030 — ITP revisions: stores each uploaded ITP and its AI-extracted civils scope

CREATE TABLE IF NOT EXISTS public.itp_revisions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid NOT NULL REFERENCES public.construction_sites(id) ON DELETE CASCADE,
  revision        text NOT NULL,                -- e.g. 'Rev 1', 'Rev A', 'Rev 2'
  file_name       text NOT NULL,
  storage_path    text,
  raw_text        text,
  ai_activities   jsonb,                        -- extracted civils scope as [{activity_group, category, description, itp_ref, is_complete, completion_evidence}]
  is_baseline     boolean NOT NULL DEFAULT false,
  diff_summary    jsonb,                        -- vs baseline: {added:[], removed:[], completed:[], changed:[]}
  uploaded_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at     timestamptz DEFAULT now(),
  analysed_at     timestamptz
);

CREATE INDEX IF NOT EXISTS itp_revisions_site_id_idx ON public.itp_revisions(site_id);

ALTER TABLE public.itp_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "itp_read"  ON public.itp_revisions FOR SELECT TO authenticated USING (true);
CREATE POLICY "itp_write" ON public.itp_revisions FOR ALL TO authenticated
  USING  ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','engineer','project_manager'))
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','engineer','project_manager'));
