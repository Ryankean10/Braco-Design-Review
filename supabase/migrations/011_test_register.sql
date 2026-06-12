-- ============================================================
-- Test Register
-- ============================================================

create table if not exists public.test_register (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  test_ref         text,            -- e.g. PLT-001, FAT-003 (user-assigned)
  title            text not null,
  category         text not null check (category in (
    'Civils & Geotechnical',
    'HV Electrical',
    'LV Electrical',
    'Protection & Control',
    'BESS & Inverter',
    'FAT',
    'SAT',
    'DNO / Grid',
    'Fire & Safety',
    'Other'
  )),
  test_type        text not null,   -- Plate Load Test, GI, HV Cable Test, etc.
  description      text,
  planned_date     date,
  actual_date      date,
  location         text,            -- on-site location / circuit ref
  status           text not null default 'Planned' check (status in (
    'Planned', 'In Progress', 'Pass', 'Conditional Pass', 'Fail', 'Awaiting Review', 'Cancelled'
  )),
  pass_criteria    text,
  result_summary   text,
  results_data     jsonb,           -- structured payload from external apps (plate load tester etc.)
  results_source   text,            -- 'manual' | 'plate_load_app' | 'upload'
  witnessed_by     text,            -- client rep, DNO, ICP, etc.
  certificate_ref  text,
  itp_ref          text,            -- ITP line reference
  notes            text,
  assigned_to      uuid references auth.users(id),
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Documents attached to a test (result sheets, certificates, witness sheets)
create table if not exists public.test_documents (
  id           uuid primary key default gen_random_uuid(),
  test_id      uuid not null references public.test_register(id) on delete cascade,
  storage_path text not null,
  file_name    text not null,
  file_size    integer,
  doc_type     text not null default 'Result Sheet' check (doc_type in (
    'Result Sheet', 'Certificate', 'Method Statement', 'Witness Sheet', 'Calibration Certificate', 'Other'
  )),
  uploaded_by  uuid references auth.users(id),
  uploaded_at  timestamptz not null default now()
);

-- ============================================================
-- RLS
-- ============================================================
alter table public.test_register  enable row level security;
alter table public.test_documents enable row level security;

-- All authenticated users (including client role) can read
create policy "Auth read tests"     on public.test_register  for select using (auth.role() = 'authenticated');
create policy "Auth read test_docs" on public.test_documents for select using (auth.role() = 'authenticated');

-- Admin, PM, Engineer can mutate tests
create policy "Editor mutate tests" on public.test_register for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','project_manager','engineer'))
);
create policy "Editor mutate test_docs" on public.test_documents for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','project_manager','engineer'))
);

-- External API key submission (plate load tester etc.) — handled in API route via service role
