-- Add foreign key constraint to estimates.project_id (was loose before)
ALTER TABLE public.estimates
  ADD CONSTRAINT estimates_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;
