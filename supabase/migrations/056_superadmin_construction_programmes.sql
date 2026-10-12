-- Allow superadmin to write construction_programmes.
-- Migration 023 hard-coded role IN ('admin','engineer','project_manager') with no superadmin.
DROP POLICY IF EXISTS "Engineer mutate construction_programmes" ON public.construction_programmes;
CREATE POLICY "Engineer mutate construction_programmes"
  ON public.construction_programmes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin', 'engineer', 'project_manager')
    )
  );
