-- Extend role check constraint to include all five roles
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin','project_manager','engineer','operative','client'));

-- Update any existing 'engineer' placeholder users if needed
-- (run manually per user as required)
