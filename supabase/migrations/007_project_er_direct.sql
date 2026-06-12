-- Replace document-library FK with direct file storage on the project
alter table public.projects drop column if exists er_document_id;
alter table public.projects add column if not exists er_storage_path text;
alter table public.projects add column if not exists er_file_name text;
