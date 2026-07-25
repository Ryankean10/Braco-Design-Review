-- Shared updated_at trigger function
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Vessels
create table public.vessels (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  imo_number        text unique,
  mmsi              text,
  call_sign         text,
  flag              text not null,
  port_of_registry  text,
  class_society     text check (class_society in ('LR','BV','DNV','RINA','ABS','None')),
  class_notation    text,
  vessel_type       text not null default 'Motor Yacht'
                      check (vessel_type in ('Motor Yacht','Sailing Yacht','Motor Sailer','Explorer','Other')),
  gt                numeric,
  nt                numeric,
  loa_m             numeric,
  beam_m            numeric,
  max_draught_m     numeric,
  year_built        integer,
  place_of_build    text,
  hull_material     text,
  main_engine_maker text,
  main_engine_model text,
  owner             text,
  operator          text,
  manager           text,
  image_path        text,
  status            text not null default 'active'
                      check (status in ('active','laid-up','refit','sold')),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.vessels enable row level security;

create policy "Authenticated users can read vessels"
  on public.vessels for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert vessels"
  on public.vessels for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update vessels"
  on public.vessels for update using (auth.role() = 'authenticated');

create trigger vessels_updated_at before update on public.vessels
  for each row execute function public.set_updated_at();

-- Vessel-level roles
create table public.vessel_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  vessel_id  uuid references public.vessels(id) on delete cascade,
  role       text not null check (role in ('fleet_manager','captain','chief_engineer','engineer','viewer')),
  created_at timestamptz not null default now(),
  unique (user_id, vessel_id)
);

alter table public.vessel_roles enable row level security;

create policy "Authenticated users can read vessel roles"
  on public.vessel_roles for select using (auth.role() = 'authenticated');
