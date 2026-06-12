-- ============================================================
-- Project membership for internal team (PM, engineer, operative)
-- Clients use project_clients; internal team use project_members
-- ============================================================

create table if not exists public.project_members (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  added_by   uuid references auth.users(id),
  added_at   timestamptz not null default now(),
  unique(project_id, user_id)
);

alter table public.project_members enable row level security;

create policy "Auth read project_members" on public.project_members for select
  using (auth.role() = 'authenticated');

create policy "Editor mutate project_members" on public.project_members for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('admin', 'project_manager')
    )
  );
