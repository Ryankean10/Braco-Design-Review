-- 078: Replace client-templates storage policies with profiles-based RLS
-- Removes any app_metadata.tenant_slug dependency so auth user recreation
-- never breaks access again.

-- Drop all existing policies on storage.objects for client-templates
-- (catches both the migration-074 policy and any dashboard-created policies)
DO $$
DECLARE
  pol text;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND (qual ILIKE '%client-templates%' OR with_check ILIKE '%client-templates%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol);
  END LOOP;
END $$;

-- Superadmins see everything in client-templates
CREATE POLICY "client_templates_superadmin_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'client-templates'
    AND public.is_superadmin()
  );

-- Company admins and PMs see only their company's folder
-- Keyed on profiles.company_id → companies.slug, NOT on app_metadata
CREATE POLICY "client_templates_company_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'client-templates'
    AND (storage.foldername(name))[1] = (
      SELECT c.slug
      FROM public.profiles p
      JOIN public.companies c ON c.id = p.company_id
      WHERE p.id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'superadmin', 'project_manager')
    )
  );
