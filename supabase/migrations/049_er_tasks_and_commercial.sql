-- 049 — ER task extraction, commercial RAG, and revision history

-- Tasks extracted from the ER document
CREATE TABLE IF NOT EXISTS public.er_tasks (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id               uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_text                text NOT NULL,
  category                 text,
  stage                    text,
  added_to_construction    boolean NOT NULL DEFAULT false,
  construction_activity_id uuid,
  source_revision          text,  -- storage path of ER revision this was extracted from
  created_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.er_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "er_tasks_read" ON public.er_tasks
  FOR SELECT TO authenticated USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "er_tasks_write" ON public.er_tasks
  FOR ALL TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

-- Extend projects table with new ER columns
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS er_revisions          jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS er_rag_summary        jsonb,
  ADD COLUMN IF NOT EXISTS er_rag_analysed_at    timestamptz,
  ADD COLUMN IF NOT EXISTS er_deep_analysis      jsonb,
  ADD COLUMN IF NOT EXISTS er_deep_analysed_at   timestamptz;
