-- ============================================================
-- Parallel stage tracking (replaces single projects.stage field)
-- ============================================================

create table if not exists public.project_stages (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  stage          text not null,
  status         text not null default 'Not Started' check (status in (
    'Not Started', 'In Progress', 'Complete', 'On Hold'
  )),
  -- Checklist stored as JSONB array:
  -- [{ id, label, checked, checked_by, checked_by_name, checked_at }]
  checklist      jsonb not null default '[]',
  -- Sign-off
  signed_off_by  uuid references auth.users(id),
  signed_off_at  timestamptz,
  sign_off_notes text,
  -- Timestamps
  started_at     timestamptz,
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique(project_id, stage)
);

alter table public.project_stages enable row level security;

create policy "Auth read project_stages" on public.project_stages for select
  using (auth.role() = 'authenticated');

create policy "Editor mutate project_stages" on public.project_stages for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('admin','project_manager','engineer')
    )
  );
