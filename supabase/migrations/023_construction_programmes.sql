-- Construction programme uploads (P6 / MS Project PDFs)
create table if not exists public.construction_programmes (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references public.construction_sites(id) on delete cascade,
  revision        text not null,           -- e.g. "REV4.2", "Rev 3", "Baseline"
  programme_date  date not null,           -- date the programme covers / was issued
  file_path       text not null,           -- supabase storage path
  file_name       text not null,
  notes           text,
  uploaded_by     uuid references auth.users(id),
  uploaded_at     timestamptz not null default now()
);

alter table public.construction_programmes enable row level security;

create policy "Auth read construction_programmes" on public.construction_programmes
  for select using (auth.role() = 'authenticated');

create policy "Engineer mutate construction_programmes" on public.construction_programmes
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('admin', 'engineer', 'project_manager')
    )
  );

-- Index for fast lookup by site
create index construction_programmes_site_id_idx on public.construction_programmes(site_id, uploaded_at desc);
