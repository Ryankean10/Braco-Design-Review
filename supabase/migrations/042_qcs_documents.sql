-- 042 — Quality Check Sheets (QCS) for Project Assurance

CREATE TABLE IF NOT EXISTS public.qcs_documents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  itp_activity_id   uuid REFERENCES public.test_register(id) ON DELETE SET NULL,
  title             text NOT NULL,
  activity_type     text,                        -- e.g. 'Cable Pull', 'Termination', 'Foundation Pour'
  location          text,                        -- e.g. 'Block 3 Row 2', 'BESS Unit 1'
  reference_no      text,                        -- QCS-001, QCS-002 etc
  template_key      text,                        -- which template was used
  field_data        jsonb DEFAULT '{}'::jsonb,   -- all form field values
  status            text NOT NULL DEFAULT 'wip'
                      CHECK (status IN ('wip', 'act_review', 'submitted')),
  generated_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_by_name text,
  approved_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by_name  text,
  approved_at       timestamptz,
  rejected_by_name  text,
  rejected_at       timestamptz,
  rejection_reason  text,
  pdf_storage_path  text,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Auto-increment reference number per project
CREATE OR REPLACE FUNCTION public.assign_qcs_reference()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  next_num int;
BEGIN
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(reference_no, '^QCS-0*', ''), '')::int
  ), 0) + 1
  INTO next_num
  FROM public.qcs_documents
  WHERE project_id = NEW.project_id;
  NEW.reference_no := 'QCS-' || LPAD(next_num::text, 3, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER qcs_assign_ref
  BEFORE INSERT ON public.qcs_documents
  FOR EACH ROW
  WHEN (NEW.reference_no IS NULL)
  EXECUTE FUNCTION public.assign_qcs_reference();

CREATE TRIGGER qcs_updated_at
  BEFORE UPDATE ON public.qcs_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.qcs_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qcs_internal_select" ON public.qcs_documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'engineer', 'project_manager', 'operative')
    )
  );

CREATE POLICY "qcs_internal_insert" ON public.qcs_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'engineer', 'project_manager')
    )
  );

CREATE POLICY "qcs_internal_update" ON public.qcs_documents
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'engineer', 'project_manager')
    )
  );
