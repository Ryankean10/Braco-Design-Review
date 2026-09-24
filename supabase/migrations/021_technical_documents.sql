-- Technical Information library: received docs (manuals, studies, planning)
-- Not visible to client role (enforced at app layer; policy below for defence-in-depth)

create table if not exists public.technical_documents (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  title        text not null,
  doc_ref      text,                      -- manufacturer part number / ref if any
  source       text not null default 'Other',  -- Manufacturer | Planning Authority | DNO/NESO | Consultant | Contractor | Other
  doc_type     text not null default 'Manual', -- Manual | Study | Report | Specification | Drawing | Test Certificate | Planning Document | Other
  notes        text,
  storage_path text,
  file_name    text,
  file_size    bigint,
  mime_type    text,
  uploaded_by  uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

alter table public.technical_documents enable row level security;

-- All authenticated non-client users can read
create policy "Non-client users read technical docs"
  on public.technical_documents for select
  using (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role != 'client'
    )
  );

create policy "Engineers and admins insert technical docs"
  on public.technical_documents for insert
  with check (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'engineer', 'project_manager')
    )
  );

create policy "Engineers and admins update technical docs"
  on public.technical_documents for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'engineer', 'project_manager')
    )
  );

create policy "Admin delete technical docs"
  on public.technical_documents for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- AI analysis results for technical documents
create table if not exists public.tech_doc_analyses (
  id              uuid primary key default gen_random_uuid(),
  tech_document_id uuid not null references public.technical_documents(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  status          text not null default 'pending',  -- pending | running | complete | error
  findings        jsonb,   -- array of {category, severity, title, detail, page_ref, cross_ref}
  raw_summary     text,
  error           text,
  model           text,
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);

alter table public.tech_doc_analyses enable row level security;

create policy "Non-client read analyses"
  on public.tech_doc_analyses for select
  using (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role != 'client'
    )
  );

create policy "Service role insert analyses"
  on public.tech_doc_analyses for insert
  with check (auth.role() = 'authenticated');

create policy "Service role update analyses"
  on public.tech_doc_analyses for update
  using (auth.role() = 'authenticated');

create index if not exists tech_documents_project_idx on public.technical_documents(project_id);
create index if not exists tech_analyses_doc_idx      on public.tech_doc_analyses(tech_document_id);
