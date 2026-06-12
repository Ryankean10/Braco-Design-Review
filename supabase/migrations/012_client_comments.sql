-- ============================================================
-- Client comments & document client-review flag
-- ============================================================

-- Flag documents as ready for client review
alter table public.documents
  add column if not exists for_client_review boolean not null default false,
  add column if not exists client_review_note text;  -- optional cover note when sharing

-- Client comments (on documents, tests, or general project)
create table if not exists public.client_comments (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  -- What is being commented on
  subject_type   text not null check (subject_type in ('document', 'test', 'general')),
  subject_id     uuid,    -- doc / test id; null for general project comment
  subject_label  text,    -- human-readable name for display
  -- Comment
  comment        text not null,
  created_by     uuid not null references auth.users(id),
  created_at     timestamptz not null default now(),
  -- Response workflow
  status         text not null default 'Open' check (status in ('Open', 'Responded', 'Closed')),
  response       text,
  responded_by   uuid references auth.users(id),
  responded_at   timestamptz,
  -- Client can flag response as resolved or request further action
  client_resolved boolean not null default false,
  client_resolved_at timestamptz
);

-- ============================================================
-- RLS
-- ============================================================
alter table public.client_comments enable row level security;

-- Clients can insert comments
create policy "Client insert comments" on public.client_comments for insert
  with check (
    auth.role() = 'authenticated' and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'client')
  );

-- Clients can read their own project's comments
create policy "Client read own comments" on public.client_comments for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'client')
    and created_by = auth.uid()
  );

-- Client can mark their comment as resolved (update client_resolved only)
create policy "Client resolve own comment" on public.client_comments for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- Admin, PM, Engineer can read ALL comments across all projects
create policy "Internal read comments" on public.client_comments for select
  using (
    exists (select 1 from public.profiles where id = auth.uid()
      and role in ('admin','project_manager','engineer'))
  );

-- Admin, PM, Engineer can respond (update status, response, responded_by, responded_at)
create policy "Internal respond comments" on public.client_comments for update
  using (
    exists (select 1 from public.profiles where id = auth.uid()
      and role in ('admin','project_manager','engineer'))
  );
