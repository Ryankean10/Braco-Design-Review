-- Documents table
create table if not exists public.documents (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  doc_no          text not null,
  title           text not null,
  rev             text not null default 'P01',
  type            text not null check (type in ('Drawing','Specification','Report','Schedule','Certificate','Other')),
  stage           text not null check (stage in ('Feasibility','Design','Procure','Build & Install','Test & Commission','Energise & Handover')),
  storage_path    text not null,
  file_name       text not null,
  file_size       bigint,
  mime_type       text,
  supersedes      uuid references public.documents(id),
  uploaded_by     uuid references auth.users(id),
  uploaded_at     timestamptz not null default now()
);

alter table public.documents enable row level security;

create policy "Authenticated users can read documents"
  on public.documents for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert documents"
  on public.documents for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update documents"
  on public.documents for update using (auth.role() = 'authenticated');

create policy "Admin can delete documents"
  on public.documents for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
