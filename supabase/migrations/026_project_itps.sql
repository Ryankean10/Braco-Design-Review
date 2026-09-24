-- 026 — Project ITP documents
CREATE TABLE IF NOT EXISTS public.project_itps (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name    text NOT NULL,
  storage_path text NOT NULL,
  file_size    bigint,
  description  text,
  uploaded_at  timestamptz DEFAULT now(),
  uploaded_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.project_itps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "itps_read"  ON public.project_itps FOR SELECT TO authenticated USING (true);
CREATE POLICY "itps_write" ON public.project_itps FOR ALL TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','engineer','project_manager'))
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','engineer','project_manager'));
