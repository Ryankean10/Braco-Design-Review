-- Construction module: sites, cable register, containment, activities, daily logs

-- ── Sites ─────────────────────────────────────────────────────────────────────
create table if not exists public.construction_sites (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references public.projects(id) on delete set null,  -- nullable
  name         text not null,
  client       text,
  location     text,
  capacity_mw  numeric,
  voltage_kv   numeric,
  status       text not null default 'active',  -- mobilising | active | complete | standby
  start_date   date,
  end_date     date,
  notes        text,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

-- ── Packages ──────────────────────────────────────────────────────────────────
create table if not exists public.construction_packages (
  id           uuid primary key default gen_random_uuid(),
  site_id      uuid not null references public.construction_sites(id) on delete cascade,
  name         text not null,  -- "AC Battery Cable", "33kV HV Cable", "Comms/Multicore", "Containment", "Civils"
  package_type text not null default 'cable',  -- cable | containment | civils | equipment | commissioning
  description  text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

-- ── Unified cable register ────────────────────────────────────────────────────
create table if not exists public.cable_items (
  id                  uuid primary key default gen_random_uuid(),
  site_id             uuid not null references public.construction_sites(id) on delete cascade,
  package_id          uuid references public.construction_packages(id),
  package_name        text,       -- denormalised for fast filter: "AC Battery Cable" etc.

  cable_ref           text not null,
  description         text,

  -- Route
  from_unit           text,
  from_location       text,
  from_terminal       text,
  to_unit             text,
  to_location         text,
  to_terminal         text,

  -- Spec
  cable_size          text,       -- "240mm²", "1.5mm²", "Fibre"
  num_cores           int,
  outer_dia_mm        numeric,
  length_m            numeric,
  cable_type          text,

  -- BESS grouping
  mvs                 text,       -- "MVS-1" … "MVS-7", null for site-level
  battery             text,       -- "BAT1", "BAT2", "N/A"
  area                text,       -- for non-MVS cables: "Site Level", "HV", "Comms"

  -- Flags
  requires_jointer    boolean not null default false,
  flagged             boolean not null default false,
  flag_reason         text,

  -- Links
  linked_document_id  uuid references public.documents(id) on delete set null,
  containment_route   text,       -- free text until containment register is populated

  -- Status cache (updated when activities change)
  overall_status      text not null default 'Not Started',
  completion_pct      numeric not null default 0,

  -- Import
  source              text not null default 'manual',  -- manual | csv | xlsx | email
  notes               text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (site_id, cable_ref)
);

-- ── Containment register ──────────────────────────────────────────────────────
create table if not exists public.containment_items (
  id                  uuid primary key default gen_random_uuid(),
  site_id             uuid not null references public.construction_sites(id) on delete cascade,
  package_id          uuid references public.construction_packages(id),

  containment_ref     text not null,
  description         text,
  containment_type    text not null default 'cable_tray',  -- cable_tray | ladder | basket | conduit | underground_duct | trunking

  -- Spec
  width_mm            int,
  depth_mm            int,
  length_m            numeric,
  num_supports        int,
  num_bends           int,

  -- Route
  from_location       text,
  to_location         text,
  route_description   text,

  -- Design link
  linked_document_id  uuid references public.documents(id) on delete set null,
  drawing_ref         text,

  -- Status cache
  overall_status      text not null default 'Not Started',
  completion_pct      numeric not null default 0,

  notes               text,
  created_at          timestamptz not null default now(),

  unique (site_id, containment_ref)
);

-- ── Cable → containment mapping ───────────────────────────────────────────────
create table if not exists public.cable_containment_links (
  cable_id        uuid not null references public.cable_items(id) on delete cascade,
  containment_id  uuid not null references public.containment_items(id) on delete cascade,
  segment_order   int not null default 0,
  primary key (cable_id, containment_id)
);

-- ── Cable activities ──────────────────────────────────────────────────────────
-- One row per (cable, activity, end_side) — unique constraint prevents dupes
create table if not exists public.cable_activities (
  id              uuid primary key default gen_random_uuid(),
  cable_id        uuid not null references public.cable_items(id) on delete cascade,
  site_id         uuid not null references public.construction_sites(id),

  activity        text not null,
  -- Pulled | Gland | Crimp | Terminate | Test | Torque | Dress | QCS | Cut | Installed
  -- Jointer (for 33kV) | Fibre Pulled | Fibre Terminated | Fibre Tested

  end_side        text,
  -- Battery side | Transformer side | MVS side | Both | N/A

  status          text not null default 'Not Started',
  -- Not Started | In Progress | Complete | Rework | Blocked

  completed_by    text,          -- contractor name, not a FK
  completed_at    timestamptz,
  verified_by     uuid references auth.users(id),
  verified_at     timestamptz,

  source          text not null default 'manual',  -- manual | email_import | csv
  source_text     text,          -- raw email snippet for traceability
  source_email_id text,
  confidence      text,          -- High | Medium | Low

  needs_review    boolean not null default false,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

);

-- ── Containment activities ────────────────────────────────────────────────────
create table if not exists public.containment_activities (
  id               uuid primary key default gen_random_uuid(),
  containment_id   uuid not null references public.containment_items(id) on delete cascade,
  site_id          uuid not null references public.construction_sites(id),

  activity         text not null,
  -- Install Tray | Install Supports | Install Covers | Install Bends | Earth Bond | QCS | Paint / Protect

  status           text not null default 'Not Started',
  completion_pct   numeric not null default 0,

  completed_by     text,
  completed_at     timestamptz,
  notes            text,
  created_at       timestamptz not null default now()
);

-- ── Daily site log ────────────────────────────────────────────────────────────
create table if not exists public.site_daily_logs (
  id                  uuid primary key default gen_random_uuid(),
  site_id             uuid not null references public.construction_sites(id) on delete cascade,
  log_date            date not null,

  -- Personnel: [{name, role, company, hours}]
  personnel           jsonb not null default '[]',
  total_manhours      numeric,

  -- Weather
  weather_description text,
  weather_conditions  text,   -- Good | Fair | Poor
  temp_c              numeric,
  wind_mph            numeric,
  rain_mm             numeric,
  weather_lost_hours  numeric not null default 0,
  weather_impact      text,   -- None | Low | Medium | High

  -- Issues: [{description, impact, owner, action, status}]
  issues              jsonb not null default '[]',

  -- Summary
  summary             text,
  source              text not null default 'manual',   -- manual | email_import
  source_email_id     text,
  raw_email_body      text,

  submitted_by        uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (site_id, log_date)
);

-- ── Review queue (ambiguous items from email parsing) ─────────────────────────
create table if not exists public.construction_review_items (
  id                  uuid primary key default gen_random_uuid(),
  site_id             uuid not null references public.construction_sites(id) on delete cascade,
  review_date         date,
  area                text,
  source_text         text,
  reason              text,
  recommended_action  text,
  status              text not null default 'Open',  -- Open | Resolved | Dismissed
  owner               text,
  closed_date         date,
  notes               text,
  created_at          timestamptz not null default now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.construction_sites       enable row level security;
alter table public.construction_packages    enable row level security;
alter table public.cable_items              enable row level security;
alter table public.containment_items        enable row level security;
alter table public.cable_containment_links  enable row level security;
alter table public.cable_activities         enable row level security;
alter table public.containment_activities   enable row level security;
alter table public.site_daily_logs          enable row level security;
alter table public.construction_review_items enable row level security;

-- Non-client authenticated users get full access (role enforcement at API layer)
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'construction_sites','construction_packages','cable_items','containment_items',
    'cable_containment_links','cable_activities','containment_activities',
    'site_daily_logs','construction_review_items'
  ] loop
    execute format('
      create policy "Non-client access %I"
        on public.%I for all
        using (
          auth.role() = ''authenticated''
          and exists (
            select 1 from public.profiles
            where id = auth.uid() and role != ''client''
          )
        )
        with check (
          auth.role() = ''authenticated''
          and exists (
            select 1 from public.profiles
            where id = auth.uid() and role != ''client''
          )
        );
    ', tbl, tbl);
  end loop;
end $$;

-- ── Indexes ───────────────────────────────────────────────────────────────────
-- Expression unique index for cable_activities (coalesce not allowed inline)
create unique index if not exists cable_activities_unique_idx
  on public.cable_activities (cable_id, activity, coalesce(end_side, ''));

create index if not exists cable_items_site_idx       on public.cable_items(site_id);
create index if not exists cable_items_mvs_idx        on public.cable_items(site_id, mvs);
create index if not exists cable_items_package_idx    on public.cable_items(site_id, package_name);
create index if not exists cable_items_status_idx     on public.cable_items(site_id, overall_status);
create index if not exists cable_items_ref_idx        on public.cable_items(site_id, cable_ref);
create index if not exists cable_activities_cable_idx on public.cable_activities(cable_id);
create index if not exists cable_activities_site_idx  on public.cable_activities(site_id);
create index if not exists cable_activities_review_idx on public.cable_activities(site_id, needs_review) where needs_review = true;
create index if not exists daily_logs_site_date_idx   on public.site_daily_logs(site_id, log_date desc);
create index if not exists containment_site_idx       on public.containment_items(site_id);
