-- 075: Reference Library — Templates
--
-- Downloadable template documents (forms, registers, letters, checklists)
-- shown in the Reference Library "Templates" tab.
--   • company_id NULL  → platform-wide template, visible to every company
--   • company_id set   → visible only to that company
--   • Superadmins manage all templates; company admins manage their own
--   • Files live in the private `reference-templates` bucket under
--       global/<file>            (platform-wide)
--       <company_id>/<file>      (company-specific)

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('reference-templates', 'reference-templates', false, 52428800)  -- 50 MB per file
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.reference_templates (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid        REFERENCES public.companies(id) ON DELETE CASCADE,
  title        text        NOT NULL,
  description  text,
  category     text        NOT NULL DEFAULT 'Other',
  doc_ref      text,
  version      text,
  file_name    text        NOT NULL,
  file_size    bigint,
  storage_path text        NOT NULL,
  created_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reference_templates_company_idx ON public.reference_templates (company_id);

CREATE OR REPLACE FUNCTION public.is_company_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  )
$$;

ALTER TABLE public.reference_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reference_templates_select" ON public.reference_templates;
DROP POLICY IF EXISTS "reference_templates_insert" ON public.reference_templates;
DROP POLICY IF EXISTS "reference_templates_update" ON public.reference_templates;
DROP POLICY IF EXISTS "reference_templates_delete" ON public.reference_templates;

CREATE POLICY "reference_templates_select" ON public.reference_templates
  FOR SELECT USING (
    public.is_superadmin()
    OR (public.is_internal() AND (company_id IS NULL OR company_id = public.get_user_company_id()))
  );

CREATE POLICY "reference_templates_insert" ON public.reference_templates
  FOR INSERT WITH CHECK (
    public.is_superadmin()
    OR (public.is_company_admin() AND company_id = public.get_user_company_id())
  );

CREATE POLICY "reference_templates_update" ON public.reference_templates
  FOR UPDATE USING (
    public.is_superadmin()
    OR (public.is_company_admin() AND company_id = public.get_user_company_id())
  ) WITH CHECK (
    public.is_superadmin()
    OR (public.is_company_admin() AND company_id = public.get_user_company_id())
  );

CREATE POLICY "reference_templates_delete" ON public.reference_templates
  FOR DELETE USING (
    public.is_superadmin()
    OR (public.is_company_admin() AND company_id = public.get_user_company_id())
  );

-- ── Storage policies ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "reference_templates_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "reference_templates_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "reference_templates_storage_delete" ON storage.objects;

CREATE POLICY "reference_templates_storage_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'reference-templates'
    AND (
      public.is_superadmin()
      OR (
        public.is_internal()
        AND split_part(name, '/', 1) IN ('global', public.get_user_company_id()::text)
      )
    )
  );

CREATE POLICY "reference_templates_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'reference-templates'
    AND (
      public.is_superadmin()
      OR (public.is_company_admin() AND split_part(name, '/', 1) = public.get_user_company_id()::text)
    )
  );

CREATE POLICY "reference_templates_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'reference-templates'
    AND (
      public.is_superadmin()
      OR (public.is_company_admin() AND split_part(name, '/', 1) = public.get_user_company_id()::text)
    )
  );
