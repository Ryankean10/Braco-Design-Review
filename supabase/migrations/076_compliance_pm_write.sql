DROP POLICY IF EXISTS "compliance_admin_write" ON public.compliance_documents;

CREATE POLICY "compliance_write" ON public.compliance_documents
  FOR ALL USING (
    (
      company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('admin', 'superadmin', 'project_manager')
      )
    )
    OR public.is_superadmin()
  );
