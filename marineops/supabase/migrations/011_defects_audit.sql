-- Defects and NCRs
create table public.defects (
  id                uuid primary key default gen_random_uuid(),
  vessel_id         uuid not null references public.vessels(id) on delete cascade,
  ref_no            text not null,
  title             text not null,
  description       text,
  equipment_id      uuid references public.equipment(id),
  type              text not null check (type in (
                      'defect','observation','ncr','near_miss','psc_finding')),
  severity          text not null check (severity in ('critical','major','minor','observation')),
  source            text check (source in (
                      'crew','survey','psc','internal_audit','class','insurance')),
  status            text not null default 'open'
                      check (status in ('open','in_progress','closed','deferred')),
  reported_by       uuid references auth.users(id),
  reported_date     date not null default current_date,
  work_order_id     uuid references public.work_orders(id),
  closed_date       date,
  corrective_action text,
  class_notified    boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.defects enable row level security;

create policy "Authenticated users can read defects"
  on public.defects for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert defects"
  on public.defects for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update defects"
  on public.defects for update using (auth.role() = 'authenticated');

create trigger defects_updated_at before update on public.defects
  for each row execute function public.set_updated_at();

-- Audit log (immutable — no update/delete policy)
create table public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id),
  action     text not null check (action in ('insert','update','delete')),
  table_name text not null,
  record_id  uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;

create policy "Authenticated users can read audit log"
  on public.audit_log for select using (auth.role() = 'authenticated');

create policy "System can insert audit log"
  on public.audit_log for insert with check (true);

-- Generic audit trigger function
create or replace function public.audit_trigger_fn()
returns trigger language plpgsql security definer as $$
begin
  insert into public.audit_log (user_id, action, table_name, record_id, old_values, new_values)
  values (
    auth.uid(),
    lower(TG_OP),
    TG_TABLE_NAME,
    coalesce(
      case when TG_OP <> 'DELETE' then (row_to_json(new)->>'id')::uuid end,
      case when TG_OP  = 'DELETE' then (row_to_json(old)->>'id')::uuid end
    ),
    case when TG_OP in ('DELETE','UPDATE') then row_to_json(old)::jsonb else null end,
    case when TG_OP in ('INSERT','UPDATE') then row_to_json(new)::jsonb else null end
  );
  return coalesce(new, old);
end;
$$;

-- Apply audit triggers to key tables
create trigger audit_vessels
  after insert or update or delete on public.vessels
  for each row execute function public.audit_trigger_fn();

create trigger audit_work_orders
  after insert or update or delete on public.work_orders
  for each row execute function public.audit_trigger_fn();

create trigger audit_maintenance_jobs
  after insert or update or delete on public.maintenance_jobs
  for each row execute function public.audit_trigger_fn();

create trigger audit_inventory
  after insert or update or delete on public.inventory
  for each row execute function public.audit_trigger_fn();

create trigger audit_stock_transactions
  after insert on public.stock_transactions
  for each row execute function public.audit_trigger_fn();

create trigger audit_purchase_orders
  after insert or update or delete on public.purchase_orders
  for each row execute function public.audit_trigger_fn();

create trigger audit_expenses
  after insert or update or delete on public.expenses
  for each row execute function public.audit_trigger_fn();

create trigger audit_certificates
  after insert or update or delete on public.certificates
  for each row execute function public.audit_trigger_fn();

create trigger audit_defects
  after insert or update or delete on public.defects
  for each row execute function public.audit_trigger_fn();

create trigger audit_crew
  after insert or update or delete on public.crew
  for each row execute function public.audit_trigger_fn();
