-- Add ER document link to projects
alter table public.projects add column if not exists er_document_id uuid references public.documents(id) on delete set null;

-- Store AI-identified missing standards as a JSONB array on the project
-- Each entry: { ref, title, body, category, reason }
alter table public.projects add column if not exists er_missing_standards jsonb not null default '[]'::jsonb;

-- Track when the ER was last analysed
alter table public.projects add column if not exists er_analysed_at timestamptz;
