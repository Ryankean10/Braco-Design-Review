-- Document control: status workflow, audit trail, view log, comment threads

-- ── Status field on documents ──────────────────────────────────────────────
alter table public.documents
  add column if not exists doc_status text
    not null default 'WIP'
    check (doc_status in ('WIP', 'Internal Review', 'Ready for Client Review', 'Approved for Construction'));

-- ── Status change audit trail ──────────────────────────────────────────────
create table if not exists public.document_status_history (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references public.documents(id) on delete cascade,
  project_id   uuid not null references public.projects(id) on delete cascade,
  from_status  text,
  to_status    text not null,
  changed_by   uuid references auth.users(id),
  changed_at   timestamptz not null default now(),
  note         text,
  triggered_by text not null default 'user'
                 check (triggered_by in ('user', 'client_comment'))
);

alter table public.document_status_history enable row level security;

create policy "Authenticated can read status history"
  on public.document_status_history for select using (auth.role() = 'authenticated');
create policy "Authenticated can insert status history"
  on public.document_status_history for insert with check (auth.role() = 'authenticated');

-- ── View / download log ────────────────────────────────────────────────────
create table if not exists public.document_views (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references public.documents(id) on delete cascade,
  project_id   uuid not null references public.projects(id) on delete cascade,
  viewed_by    uuid references auth.users(id),
  viewed_at    timestamptz not null default now()
);

alter table public.document_views enable row level security;

create policy "Authenticated can read views"
  on public.document_views for select using (auth.role() = 'authenticated');
create policy "Authenticated can insert views"
  on public.document_views for insert with check (auth.role() = 'authenticated');

-- ── Document comments (threaded) ───────────────────────────────────────────
create table if not exists public.document_comments (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references public.documents(id) on delete cascade,
  project_id   uuid not null references public.projects(id) on delete cascade,
  parent_id    uuid references public.document_comments(id) on delete cascade,
  comment      text not null,
  author_id    uuid references auth.users(id),
  author_role  text,
  created_at   timestamptz not null default now(),
  status       text not null default 'open'
                 check (status in ('open', 'resolved')),
  resolved_by  uuid references auth.users(id),
  resolved_at  timestamptz
);

alter table public.document_comments enable row level security;

create policy "Authenticated can read doc comments"
  on public.document_comments for select using (auth.role() = 'authenticated');
create policy "Authenticated can insert doc comments"
  on public.document_comments for insert with check (auth.role() = 'authenticated');
create policy "Authenticated can update doc comments"
  on public.document_comments for update using (auth.role() = 'authenticated');
