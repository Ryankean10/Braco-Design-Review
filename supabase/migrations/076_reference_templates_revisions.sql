-- 076: Reference Library templates — project manager access, archiving, revisions
--
--   • Project managers can upload, edit, archive and up-rev their company's
--     templates (previously admin-only). Hard delete stays admin/superadmin.
--   • Templates can be archived (hidden by default, restorable).
--   • Up-rev replaces the current file and moves the superseded revision into
--     reference_template_revisions so earlier versions remain downloadable.

ALTER TABLE public.reference_templates
  ADD COLUMN IF NOT EXISTS archived_at    timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revision_notes text,
  ADD COLUMN IF NOT EXISTS updated_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.reference_template_revisions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id    uuid        NOT NULL REFERENCES public.reference_templates(id) ON DELETE CASCADE,
  version        text,
  file_name      text        NOT NULL,
  file_size      bigint,
  storage_path   text        NOT NULL,
  revision_notes text,
  uploaded_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at    timestamptz NOT NULL,
  superseded_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reference_template_revisions_template_idx
  ON public.reference_template_revisions (template_id, superseded_at DESC);

CREATE OR REPLACE FUNCTION public.is_template_manager()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('superadmin', 'admin', 'project_manager')
  )
$$;

-- ── reference_templates policies ──────────────────────────────────────────────

DROP POLICY IF EXISTS "reference_templates_insert" ON public.reference_templates;
DROP POLICY IF EXISTS "reference_templates_update" ON public.reference_templates;

CREATE POLICY "reference_templates_insert" ON public.reference_templates
  FOR INSERT WITH CHECK (
    public.is_superadmin()
    OR (public.is_template_manager() AND company_id = public.get_user_company_id())
  );

CREATE POLICY "reference_templates_update" ON public.reference_templates
  FOR UPDATE USING (
    public.is_superadmin()
    OR (public.is_template_manager() AND company_id = public.get_user_company_id())
  ) WITH CHECK (
    public.is_superadmin()
    OR (public.is_template_manager() AND company_id = public.get_user_company_id())
  );
-- reference_templates_delete (075) stays admin/superadmin only.

-- ── reference_template_revisions policies ─────────────────────────────────────

ALTER TABLE public.reference_template_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reference_template_revisions_select" ON public.reference_template_revisions;
DROP POLICY IF EXISTS "reference_template_revisions_insert" ON public.reference_template_revisions;
DROP POLICY IF EXISTS "reference_template_revisions_delete" ON public.reference_template_revisions;

-- Visible whenever the parent template is visible (parent RLS applies in the subquery)
CREATE POLICY "reference_template_revisions_select" ON public.reference_template_revisions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.reference_templates t WHERE t.id = template_id)
  );

CREATE POLICY "reference_template_revisions_insert" ON public.reference_template_revisions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reference_templates t
      WHERE t.id = template_id
      AND (
        public.is_superadmin()
        OR (public.is_template_manager() AND t.company_id = public.get_user_company_id())
      )
    )
  );

CREATE POLICY "reference_template_revisions_delete" ON public.reference_template_revisions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.reference_templates t
      WHERE t.id = template_id
      AND (
        public.is_superadmin()
        OR (public.is_company_admin() AND t.company_id = public.get_user_company_id())
      )
    )
  );

-- ── Storage: project managers may upload to their company folder ─────────────

DROP POLICY IF EXISTS "reference_templates_storage_insert" ON storage.objects;

CREATE POLICY "reference_templates_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'reference-templates'
    AND (
      public.is_superadmin()
      OR (public.is_template_manager() AND split_part(name, '/', 1) = public.get_user_company_id()::text)
    )
  );
-- reference_templates_storage_delete (075) stays admin/superadmin only, so
-- superseded revision files are never removed by project managers.

-- ── Up-rev: archive the current file as a revision and swap in the new one ────
-- SECURITY INVOKER so the caller's RLS applies; runs as a single transaction.

CREATE OR REPLACE FUNCTION public.up_rev_reference_template(
  p_template_id    uuid,
  p_version        text,
  p_file_name      text,
  p_file_size      bigint,
  p_storage_path   text,
  p_revision_notes text
)
RETURNS public.reference_templates
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_current public.reference_templates;
  v_updated public.reference_templates;
BEGIN
  SELECT * INTO v_current FROM public.reference_templates WHERE id = p_template_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found';
  END IF;
  IF v_current.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Restore the template before issuing a new revision';
  END IF;

  INSERT INTO public.reference_template_revisions
    (template_id, version, file_name, file_size, storage_path, revision_notes, uploaded_by, uploaded_at)
  VALUES
    (v_current.id, v_current.version, v_current.file_name, v_current.file_size, v_current.storage_path,
     v_current.revision_notes, COALESCE(v_current.updated_by, v_current.created_by), v_current.updated_at);

  UPDATE public.reference_templates SET
    version        = NULLIF(trim(p_version), ''),
    file_name      = p_file_name,
    file_size      = p_file_size,
    storage_path   = p_storage_path,
    revision_notes = NULLIF(trim(p_revision_notes), ''),
    updated_by     = auth.uid(),
    updated_at     = now()
  WHERE id = p_template_id
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You do not have permission to revise this template';
  END IF;

  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.up_rev_reference_template(uuid, text, text, bigint, text, text) TO authenticated;
