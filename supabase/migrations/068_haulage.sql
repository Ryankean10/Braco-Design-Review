-- Haulage module
-- Vehicles
create table if not exists public.haulage_vehicles (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  name        text not null,        -- e.g. "Volvo FH16 – SY21 XXX"
  reg         text,
  category    text not null default 'lorry', -- lorry, van, flatbed, tipper, other
  is_active   boolean not null default true,
  notes       text,
  created_at  timestamptz not null default now()
);
alter table public.haulage_vehicles enable row level security;
create policy "Auth read haulage_vehicles" on public.haulage_vehicles for select using (auth.role() = 'authenticated');
create policy "Admin mutate haulage_vehicles" on public.haulage_vehicles for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','superadmin','project_manager'))
);

-- Tasks (planned jobs for a driver on a given day)
create table if not exists public.haulage_tasks (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  task_date    date not null,
  driver_id    uuid references public.people(id) on delete set null,
  vehicle_id   uuid references public.haulage_vehicles(id) on delete set null,
  project_id   uuid references public.projects(id) on delete set null,
  title        text not null,
  description  text,
  location     text,
  est_start    time,
  est_end      time,
  sort_order   int not null default 0,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now()
);
alter table public.haulage_tasks enable row level security;
create policy "Auth read haulage_tasks" on public.haulage_tasks for select using (auth.role() = 'authenticated');
create policy "Admin mutate haulage_tasks" on public.haulage_tasks for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','superadmin','project_manager','engineer'))
);
create index haulage_tasks_date_idx on public.haulage_tasks(company_id, task_date);

-- Daily sheets (one per driver per day, created when brief is sent or reply received)
create table if not exists public.haulage_daily_sheets (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  driver_id       uuid references public.people(id) on delete set null,
  sheet_date      date not null,
  status          text not null default 'pending'
                  check (status in ('pending','received','flagged','approved')),
  brief_sent_at   timestamptz,
  reply_received_at timestamptz,
  raw_reply       text,
  email_thread_id text,
  total_hours     numeric(5,2),
  notes           text,
  approved_by     uuid references auth.users(id),
  approved_at     timestamptz,
  created_at      timestamptz not null default now(),
  unique (driver_id, sheet_date)
);
alter table public.haulage_daily_sheets enable row level security;
create policy "Auth read haulage_daily_sheets" on public.haulage_daily_sheets for select using (auth.role() = 'authenticated');
create policy "Admin mutate haulage_daily_sheets" on public.haulage_daily_sheets for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','superadmin','project_manager','engineer'))
);
create index haulage_sheets_date_idx on public.haulage_daily_sheets(company_id, sheet_date);

-- Sheet lines (one per task/ad-hoc item parsed from the driver reply)
create table if not exists public.haulage_sheet_lines (
  id           uuid primary key default gen_random_uuid(),
  sheet_id     uuid not null references public.haulage_daily_sheets(id) on delete cascade,
  task_id      uuid references public.haulage_tasks(id) on delete set null,
  project_id   uuid references public.projects(id) on delete set null,
  description  text not null,
  start_time   time,
  end_time     time,
  hours        numeric(5,2),
  is_flagged   boolean not null default false,
  flag_reason  text,
  is_adhoc     boolean not null default false,
  sort_order   int not null default 0
);
alter table public.haulage_sheet_lines enable row level security;
create policy "Auth read haulage_sheet_lines" on public.haulage_sheet_lines for select using (auth.role() = 'authenticated');
create policy "Admin mutate haulage_sheet_lines" on public.haulage_sheet_lines for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','superadmin','project_manager','engineer'))
);
