-- Crew roster
create table public.crew (
  id               uuid primary key default gen_random_uuid(),
  vessel_id        uuid not null references public.vessels(id) on delete cascade,
  user_id          uuid references auth.users(id),
  first_name       text not null,
  last_name        text not null,
  rank             text not null check (rank in (
                     'Captain','Chief Officer','Second Officer','Third Officer',
                     'Chief Engineer','Second Engineer','Third Engineer',
                     'Bosun','Able Seaman','Ordinary Seaman',
                     'Chief Steward','Stewardess','Cook','Deckhand','Other')),
  nationality      text,
  passport_no      text,
  seaman_book_no   text,
  date_of_birth    date,
  sign_on_date     date,
  sign_off_date    date,
  status           text not null default 'onboard'
                     check (status in ('onboard','signed_off','shore_based')),
  contact_email    text,
  contact_phone    text,
  nok_name         text,
  nok_contact      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.crew enable row level security;

create policy "Authenticated users can read crew"
  on public.crew for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert crew"
  on public.crew for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update crew"
  on public.crew for update using (auth.role() = 'authenticated');

create trigger crew_updated_at before update on public.crew
  for each row execute function public.set_updated_at();

-- Add crew FK to certificates
alter table public.certificates
  add constraint fk_cert_crew
  foreign key (crew_id) references public.crew(id) on delete cascade;
