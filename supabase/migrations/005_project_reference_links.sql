-- ============================================================
-- Project ↔ Reference Library join tables
-- One table per reference type for clean querying
-- ============================================================

create table if not exists public.project_standards (
  project_id   uuid not null references public.projects(id) on delete cascade,
  standard_id  uuid not null references public.standards(id) on delete cascade,
  added_by     uuid references auth.users(id),
  added_at     timestamptz not null default now(),
  primary key (project_id, standard_id)
);

create table if not exists public.project_hs_references (
  project_id  uuid not null references public.projects(id) on delete cascade,
  hs_id       uuid not null references public.hs_references(id) on delete cascade,
  added_by    uuid references auth.users(id),
  added_at    timestamptz not null default now(),
  primary key (project_id, hs_id)
);

create table if not exists public.project_lessons_learned (
  project_id  uuid not null references public.projects(id) on delete cascade,
  lesson_id   uuid not null references public.lessons_learned(id) on delete cascade,
  added_by    uuid references auth.users(id),
  added_at    timestamptz not null default now(),
  primary key (project_id, lesson_id)
);

create table if not exists public.project_operator_rules (
  project_id  uuid not null references public.projects(id) on delete cascade,
  rule_id     uuid not null references public.operator_rules(id) on delete cascade,
  added_by    uuid references auth.users(id),
  added_at    timestamptz not null default now(),
  primary key (project_id, rule_id)
);

-- RLS — all authenticated users can read; engineers can add/remove their own project links
alter table public.project_standards enable row level security;
alter table public.project_hs_references enable row level security;
alter table public.project_lessons_learned enable row level security;
alter table public.project_operator_rules enable row level security;

create policy "Auth read project_standards" on public.project_standards for select using (auth.role() = 'authenticated');
create policy "Auth read project_hs_references" on public.project_hs_references for select using (auth.role() = 'authenticated');
create policy "Auth read project_lessons_learned" on public.project_lessons_learned for select using (auth.role() = 'authenticated');
create policy "Auth read project_operator_rules" on public.project_operator_rules for select using (auth.role() = 'authenticated');

create policy "Auth mutate project_standards" on public.project_standards for all using (auth.role() = 'authenticated');
create policy "Auth mutate project_hs_references" on public.project_hs_references for all using (auth.role() = 'authenticated');
create policy "Auth mutate project_lessons_learned" on public.project_lessons_learned for all using (auth.role() = 'authenticated');
create policy "Auth mutate project_operator_rules" on public.project_operator_rules for all using (auth.role() = 'authenticated');
