-- Lessons learned: add created_by for audit trail
alter table public.lessons_learned add column if not exists created_by uuid references auth.users(id);
alter table public.lessons_learned add column if not exists project_ref text; -- free-text project name/ref it came from

-- Standards: allow attaching the actual standard document PDF
alter table public.standards add column if not exists doc_storage_path text;
alter table public.standards add column if not exists doc_file_name text;
alter table public.standards add column if not exists doc_file_size bigint;
