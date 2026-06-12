-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null default 'engineer' check (role in ('admin', 'engineer')),
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'engineer')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Projects
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  client        text not null,
  location      text not null,
  capacity_mw   numeric,
  stage         text not null default 'Feasibility' check (stage in (
                  'Feasibility','Design','Procure',
                  'Build & Install','Test & Commission','Energise & Handover'
                )),
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "Authenticated users can read projects"
  on public.projects for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert projects"
  on public.projects for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update projects"
  on public.projects for update
  using (auth.role() = 'authenticated');

create policy "Admin can delete projects"
  on public.projects for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
