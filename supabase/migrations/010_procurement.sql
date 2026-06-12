-- ============================================================
-- Procurement module
-- ============================================================

-- Supplier / contact database (cross-project)
create table if not exists public.procurement_suppliers (
  id           uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text,
  email        text,
  phone        text,
  address      text,
  categories   text[] not null default '{}',  -- what they supply
  notes        text,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Procurement items per project
create table if not exists public.procurement_items (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects(id) on delete cascade,
  title                text not null,
  description          text,
  category             text not null check (category in (
    'BESS Equipment','HV Electrical','LV Electrical','Protection & Control',
    'Transformer','Switchgear','Cables & Containment','Civil & Structural',
    'Mechanical & HVAC','Fire Suppression','Telecoms & SCADA','Other'
  )),
  quantity             numeric,
  unit                 text,
  -- Dates & lead time
  required_by_date     date,
  estimated_lead_weeks integer,
  order_by_date        date generated always as (
    case when required_by_date is not null and estimated_lead_weeks is not null
    then (required_by_date - (estimated_lead_weeks * 7)::integer)
    else null end
  ) stored,
  -- Status
  status               text not null default 'Draft' check (status in (
    'Draft','Quoted','PO Raised','Ordered','Delivered','Cancelled'
  )),
  -- M3 spec match (wired up later)
  spec_matched         boolean,
  spec_notes           text,
  -- Source
  er_extracted         boolean not null default false,
  notes                text,
  created_by           uuid references auth.users(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Quotes per item
create table if not exists public.procurement_quotes (
  id               uuid primary key default gen_random_uuid(),
  item_id          uuid not null references public.procurement_items(id) on delete cascade,
  supplier_id      uuid references public.procurement_suppliers(id) on delete set null,
  supplier_name    text,          -- free text fallback if no supplier record
  quote_ref        text,
  quote_date       date,
  validity_date    date,
  unit_price       numeric(12,2),
  total_price      numeric(12,2),
  currency         text not null default 'GBP',
  lead_time_weeks  integer,
  -- Uploaded document
  storage_path     text,
  file_name        text,
  file_type        text check (file_type in ('pdf','email','other')),
  -- AI extraction
  ai_extracted     boolean not null default false,
  ai_raw           text,          -- raw Claude output for audit
  is_preferred     boolean not null default false,
  notes            text,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now()
);

-- ============================================================
-- RLS
-- ============================================================
alter table public.procurement_suppliers enable row level security;
alter table public.procurement_items enable row level security;
alter table public.procurement_quotes enable row level security;

-- All authenticated users can read
drop policy if exists "Auth read suppliers"   on public.procurement_suppliers;
drop policy if exists "Auth read proc_items"  on public.procurement_items;
drop policy if exists "Auth read proc_quotes" on public.procurement_quotes;
drop policy if exists "Editor mutate proc_items"  on public.procurement_items;
drop policy if exists "Editor mutate proc_quotes" on public.procurement_quotes;
drop policy if exists "Auth mutate suppliers" on public.procurement_suppliers;

create policy "Auth read suppliers"   on public.procurement_suppliers for select using (auth.role() = 'authenticated');
create policy "Auth read proc_items"  on public.procurement_items     for select using (auth.role() = 'authenticated');
create policy "Auth read proc_quotes" on public.procurement_quotes     for select using (auth.role() = 'authenticated');

-- Admin, PM, Engineer can mutate items and quotes
create policy "Editor mutate proc_items" on public.procurement_items for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','project_manager','engineer'))
);
create policy "Editor mutate proc_quotes" on public.procurement_quotes for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','project_manager','engineer'))
);
-- All authenticated can add suppliers (cross-project shared resource)
create policy "Auth mutate suppliers" on public.procurement_suppliers for all using (auth.role() = 'authenticated');
