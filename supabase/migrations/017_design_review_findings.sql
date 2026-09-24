-- Design review runs and findings for M3 AI Design Analysis

create table public.design_review_runs (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  run_by        uuid references auth.users(id),
  run_at        timestamptz not null default now(),
  document_ids  jsonb not null default '[]',
  lenses        jsonb not null default '[]',
  status        text not null default 'pending'
                  check (status in ('pending','running','complete','failed')),
  error         text,
  created_at    timestamptz not null default now()
);

alter table public.design_review_runs enable row level security;

create policy "Authenticated users can read review runs"
  on public.design_review_runs for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert review runs"
  on public.design_review_runs for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update review runs"
  on public.design_review_runs for update using (auth.role() = 'authenticated');


create table public.design_findings (
  id                   uuid primary key default gen_random_uuid(),
  run_id               uuid not null references public.design_review_runs(id) on delete cascade,
  project_id           uuid not null references public.projects(id) on delete cascade,
  lens                 text not null check (lens in ('er_compliance','standards','constructability','procurement','clash')),
  severity             text not null check (severity in ('Critical','Major','Minor','Observation')),
  title                text not null,
  description          text not null,
  clause_ref           text,
  drawing_refs         jsonb not null default '[]',
  document_refs        jsonb not null default '[]',
  procurement_item_id  uuid,
  status               text not null default 'Pending'
                         check (status in ('Pending','Approved','Rejected')),
  reviewed_by          uuid references auth.users(id),
  reviewed_at          timestamptz,
  review_notes         text,
  created_at           timestamptz not null default now()
);

alter table public.design_findings enable row level security;

create policy "Authenticated users can read findings"
  on public.design_findings for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert findings"
  on public.design_findings for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update findings"
  on public.design_findings for update using (auth.role() = 'authenticated');
