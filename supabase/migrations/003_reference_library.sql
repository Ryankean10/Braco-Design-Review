-- ============================================================
-- Reference Library tables
-- ============================================================

-- 1. Standards register
create table if not exists public.standards (
  id            uuid primary key default gen_random_uuid(),
  ref           text not null unique,          -- e.g. "ENA EREC G99 Issue 2"
  title         text not null,
  body          text not null,                 -- issuing body / organisation
  category      text not null check (category in (
    'Grid Connection','Protection','Safety','Civils & Geotechnical',
    'Electrical','Fire & BESS Safety','Temporary Works','CDM / H&S','Other'
  )),
  status        text not null default 'In Force' check (status in ('In Force','Withdrawn','Draft','Superseded')),
  effective_date date,
  summary       text,
  source_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 2. Clauses within a standard
create table if not exists public.standard_clauses (
  id            uuid primary key default gen_random_uuid(),
  standard_id   uuid not null references public.standards(id) on delete cascade,
  clause_ref    text not null,                 -- e.g. "Section 5.2.3"
  heading       text not null,
  body          text not null,                 -- verbatim or close-paraphrase of the clause
  review_lenses text[] not null default '{}', -- which AI lenses should check this clause
  severity_hint text check (severity_hint in ('Critical','Major','Minor','Observation')),
  created_at    timestamptz not null default now()
);

-- 3. ER clauses (project-level Employer's Requirements)
create table if not exists public.er_clauses (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references public.projects(id) on delete cascade,
  clause_ref    text not null,
  heading       text,
  body          text not null,
  standards_cited text[],                      -- standards referenced within the clause
  review_lenses text[] not null default '{}',
  severity_hint text check (severity_hint in ('Critical','Major','Minor','Observation')),
  created_at    timestamptz not null default now()
);

-- 4. Health & Safety references
create table if not exists public.hs_references (
  id            uuid primary key default gen_random_uuid(),
  ref           text not null,                 -- e.g. "CDM 2015 Reg 11"
  title         text not null,
  duty_holder   text,                          -- e.g. "Principal Designer"
  body          text not null,
  category      text not null check (category in (
    'CDM','Underground Services','Working at Height','Lifting Operations',
    'Fire & Explosion','Electrical Safety','Manual Handling','Other'
  )),
  source_url    text,
  created_at    timestamptz not null default now()
);

-- 5. Lessons learned
create table if not exists public.lessons_learned (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text not null,
  category      text not null check (category in (
    'Design','Procurement','Construction','Commissioning','Electrical',
    'Civils','Protection','Grid Connection','H&S','Other'
  )),
  severity      text not null check (severity in ('Critical','Major','Minor','Observation')),
  source        text,                          -- e.g. "Braco project 2024"
  review_lenses text[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 6. Operator / DNO rules
create table if not exists public.operator_rules (
  id            uuid primary key default gen_random_uuid(),
  operator      text not null,                 -- e.g. "SSEN", "ENWL", "NESO"
  rule_ref      text not null,
  title         text not null,
  body          text not null,
  category      text not null check (category in (
    'Protection Settings','Reactive Power','Fault Ride-Through','Reconnection',
    'Metering','Earthing','Comms & SCADA','Grid Code','DNO Civils','Other'
  )),
  applicable_voltage_kv text,
  source_url    text,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- RLS
-- ============================================================
alter table public.standards enable row level security;
alter table public.standard_clauses enable row level security;
alter table public.er_clauses enable row level security;
alter table public.hs_references enable row level security;
alter table public.lessons_learned enable row level security;
alter table public.operator_rules enable row level security;

-- All authenticated users can read
create policy "Auth read standards" on public.standards for select using (auth.role() = 'authenticated');
create policy "Auth read standard_clauses" on public.standard_clauses for select using (auth.role() = 'authenticated');
create policy "Auth read er_clauses" on public.er_clauses for select using (auth.role() = 'authenticated');
create policy "Auth read hs_references" on public.hs_references for select using (auth.role() = 'authenticated');
create policy "Auth read lessons_learned" on public.lessons_learned for select using (auth.role() = 'authenticated');
create policy "Auth read operator_rules" on public.operator_rules for select using (auth.role() = 'authenticated');

-- Only admin can mutate
create policy "Admin mutate standards" on public.standards for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admin mutate standard_clauses" on public.standard_clauses for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admin mutate er_clauses" on public.er_clauses for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admin mutate hs_references" on public.hs_references for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admin mutate lessons_learned" on public.lessons_learned for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admin mutate operator_rules" on public.operator_rules for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
