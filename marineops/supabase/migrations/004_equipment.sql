-- Locations (hierarchical)
create table public.locations (
  id        uuid primary key default gen_random_uuid(),
  vessel_id uuid not null references public.vessels(id) on delete cascade,
  name      text not null,
  parent_id uuid references public.locations(id)
);

alter table public.locations enable row level security;

create policy "Authenticated users can read locations"
  on public.locations for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert locations"
  on public.locations for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update locations"
  on public.locations for update using (auth.role() = 'authenticated');

-- Equipment registry
create table public.equipment (
  id               uuid primary key default gen_random_uuid(),
  vessel_id        uuid not null references public.vessels(id) on delete cascade,
  location_id      uuid references public.locations(id),
  name             text not null,
  category         text not null check (category in (
                     'Propulsion','Navigation','Safety','Electrical',
                     'HVAC','Deck','Hull','Anchor & Mooring','Galley','Other')),
  maker            text,
  model            text,
  serial_no        text,
  year_installed   integer,
  running_hours    numeric default 0,
  hours_updated_at timestamptz,
  status           text not null default 'operational'
                     check (status in ('operational','degraded','failed','decommissioned')),
  critical         boolean not null default false,
  class_item       boolean not null default false,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.equipment enable row level security;

create policy "Authenticated users can read equipment"
  on public.equipment for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert equipment"
  on public.equipment for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update equipment"
  on public.equipment for update using (auth.role() = 'authenticated');

create trigger equipment_updated_at before update on public.equipment
  for each row execute function public.set_updated_at();

-- Running hours log
create table public.running_hours_log (
  id           uuid primary key default gen_random_uuid(),
  vessel_id    uuid not null references public.vessels(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  hours        numeric not null,
  date         date not null,
  notes        text,
  recorded_by  uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

alter table public.running_hours_log enable row level security;

create policy "Authenticated users can read running hours"
  on public.running_hours_log for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert running hours"
  on public.running_hours_log for insert with check (auth.role() = 'authenticated');
