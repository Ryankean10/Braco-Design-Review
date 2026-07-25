-- Planned Maintenance Jobs
create table public.maintenance_jobs (
  id                uuid primary key default gen_random_uuid(),
  vessel_id         uuid not null references public.vessels(id) on delete cascade,
  equipment_id      uuid references public.equipment(id),
  title             text not null,
  description       text,
  category          text not null check (category in (
                      'Routine','Seasonal','Overhaul','Condition-based','Class')),
  interval_type     text not null check (interval_type in ('calendar','hours','both')),
  interval_days     integer,
  interval_hours    numeric,
  last_done_date    date,
  last_done_hours   numeric,
  next_due_date     date,
  next_due_hours    numeric,
  estimated_hours   numeric,
  requires_shutdown boolean not null default false,
  class_required    boolean not null default false,
  priority          text not null default 'medium'
                      check (priority in ('critical','high','medium','low')),
  status            text not null default 'active'
                      check (status in ('active','suspended','decommissioned')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.maintenance_jobs enable row level security;

create policy "Authenticated users can read maintenance jobs"
  on public.maintenance_jobs for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert maintenance jobs"
  on public.maintenance_jobs for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update maintenance jobs"
  on public.maintenance_jobs for update using (auth.role() = 'authenticated');

create trigger maintenance_jobs_updated_at before update on public.maintenance_jobs
  for each row execute function public.set_updated_at();

-- Work Orders
create table public.work_orders (
  id                          uuid primary key default gen_random_uuid(),
  vessel_id                   uuid not null references public.vessels(id) on delete cascade,
  job_id                      uuid references public.maintenance_jobs(id),
  wo_number                   text not null,
  title                       text not null,
  description                 text,
  type                        text not null check (type in ('planned','corrective','class','warranty','improvement')),
  status                      text not null default 'open'
                                check (status in ('draft','open','in_progress','completed','cancelled')),
  planned_date                date,
  started_at                  timestamptz,
  completed_at                timestamptz,
  assigned_to                 uuid references auth.users(id),
  actual_hours                numeric,
  running_hours_at_completion numeric,
  labor_cost                  numeric,
  budget_code_id              uuid,
  remarks                     text,
  created_by                  uuid references auth.users(id),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

alter table public.work_orders enable row level security;

create policy "Authenticated users can read work orders"
  on public.work_orders for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert work orders"
  on public.work_orders for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update work orders"
  on public.work_orders for update using (auth.role() = 'authenticated');

create trigger work_orders_updated_at before update on public.work_orders
  for each row execute function public.set_updated_at();
