-- Maritime documents
create table public.documents (
  id                uuid primary key default gen_random_uuid(),
  vessel_id         uuid not null references public.vessels(id) on delete cascade,
  doc_no            text,
  title             text not null,
  category          text not null check (category in (
                      'Class','Safety','Technical','Manual','Legal','ISM','ISPS','MLC','Crew','Other')),
  type              text not null check (type in (
                      'Certificate','Manual','Drawing','Report','Record','Form','Policy','Other')),
  rev               text,
  issue_date        date,
  expiry_date       date,
  issuing_authority text,
  storage_path      text,
  file_name         text,
  file_size         bigint,
  mime_type         text,
  supersedes        uuid references public.documents(id),
  status            text not null default 'valid'
                      check (status in ('valid','expiring_soon','expired','superseded','pending')),
  notes             text,
  uploaded_by       uuid references auth.users(id),
  uploaded_at       timestamptz not null default now()
);

alter table public.documents enable row level security;

create policy "Authenticated users can read documents"
  on public.documents for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert documents"
  on public.documents for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update documents"
  on public.documents for update using (auth.role() = 'authenticated');

-- Certificates (vessel and crew)
create table public.certificates (
  id                uuid primary key default gen_random_uuid(),
  vessel_id         uuid references public.vessels(id) on delete cascade,
  crew_id           uuid,
  entity_type       text not null check (entity_type in ('vessel','crew')),
  name              text not null,
  cert_number       text,
  issuing_authority text,
  issue_date        date,
  expiry_date       date,
  flag_state        text,
  class_society     text,
  class_required    boolean not null default false,
  survey_type       text check (survey_type in (
                      'initial','annual','intermediate','renewal','special','dry_dock','bottom')),
  document_id       uuid references public.documents(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.certificates enable row level security;

create policy "Authenticated users can read certificates"
  on public.certificates for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert certificates"
  on public.certificates for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update certificates"
  on public.certificates for update using (auth.role() = 'authenticated');

create trigger certificates_updated_at before update on public.certificates
  for each row execute function public.set_updated_at();

-- Certificate status view (computed from current_date)
create view public.certificate_status as
  select
    c.*,
    case
      when c.expiry_date is null then 'no_expiry'
      when c.expiry_date < current_date then 'expired'
      when c.expiry_date < current_date + interval '30 days' then 'critical'
      when c.expiry_date < current_date + interval '90 days' then 'expiring_soon'
      else 'valid'
    end as status,
    c.expiry_date - current_date as days_remaining
  from public.certificates c;

-- Class society surveys
create table public.surveys (
  id              uuid primary key default gen_random_uuid(),
  vessel_id       uuid not null references public.vessels(id) on delete cascade,
  type            text not null check (type in (
                    'annual','intermediate','special','dry_dock','bottom',
                    'continuous','flag_state','isps')),
  class_society   text,
  due_date        date not null,
  window_start    date,
  window_end      date,
  completed_date  date,
  surveyor        text,
  survey_location text,
  status          text not null default 'pending'
                    check (status in ('pending','in_progress','completed','overdue','waived')),
  remarks         text,
  work_order_id   uuid references public.work_orders(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.surveys enable row level security;

create policy "Authenticated users can read surveys"
  on public.surveys for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert surveys"
  on public.surveys for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update surveys"
  on public.surveys for update using (auth.role() = 'authenticated');

create trigger surveys_updated_at before update on public.surveys
  for each row execute function public.set_updated_at();
