-- ============================================================
-- Project-client assignment: links client users to projects
-- ============================================================

create table if not exists public.project_clients (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  added_by   uuid references auth.users(id),
  added_at   timestamptz not null default now(),
  unique(project_id, user_id)
);

alter table public.project_clients enable row level security;

-- Any authenticated user can read assignments (needed for admin UI)
create policy "Auth read project_clients" on public.project_clients for select
  using (auth.role() = 'authenticated');

-- Only admin/PM can add or remove
create policy "Editor mutate project_clients" on public.project_clients for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('admin', 'project_manager')
    )
  );
