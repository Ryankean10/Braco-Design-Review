-- 044 — project-qcs storage bucket policies
-- The bucket itself is created programmatically by the generation engine if absent.
-- These policies grant internal roles access to generated QCS DOCX files.

-- Allow internal roles to read generated QCS files
CREATE POLICY "project_qcs_internal_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-qcs'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'engineer', 'project_manager', 'operative')
    )
  );

-- Allow admin/engineer to upload generated QCS files (service role bypasses RLS but belt-and-braces)
CREATE POLICY "project_qcs_internal_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-qcs'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'engineer')
    )
  );

-- Allow admin/engineer to overwrite (upsert) generated QCS files
CREATE POLICY "project_qcs_internal_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'project-qcs'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'engineer')
    )
  );
