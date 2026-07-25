-- Inventory
create table public.inventory (
  id                   uuid primary key default gen_random_uuid(),
  vessel_id            uuid not null references public.vessels(id) on delete cascade,
  part_no              text,
  name                 text not null,
  description          text,
  maker                text,
  compatible_equipment uuid[],
  category             text,
  location_on_vessel   text,
  unit                 text not null default 'each',
  quantity             numeric not null default 0,
  min_quantity         numeric not null default 0,
  reorder_quantity     numeric,
  unit_cost            numeric,
  critical_spare       boolean not null default false,
  class_required       boolean not null default false,
  image_path           text,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.inventory enable row level security;

create policy "Authenticated users can read inventory"
  on public.inventory for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert inventory"
  on public.inventory for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update inventory"
  on public.inventory for update using (auth.role() = 'authenticated');

create trigger inventory_updated_at before update on public.inventory
  for each row execute function public.set_updated_at();

-- Stock transactions
create table public.stock_transactions (
  id            uuid primary key default gen_random_uuid(),
  vessel_id     uuid not null references public.vessels(id) on delete cascade,
  inventory_id  uuid not null references public.inventory(id) on delete cascade,
  type          text not null check (type in ('receipt','issue','adjustment','transfer')),
  quantity      numeric not null,
  unit_cost     numeric,
  work_order_id uuid references public.work_orders(id),
  po_id         uuid,
  reference     text,
  date          date not null default current_date,
  notes         text,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);

alter table public.stock_transactions enable row level security;

create policy "Authenticated users can read stock transactions"
  on public.stock_transactions for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert stock transactions"
  on public.stock_transactions for insert with check (auth.role() = 'authenticated');

-- Auto-update inventory quantity on stock transaction
create or replace function public.apply_stock_transaction()
returns trigger language plpgsql as $$
begin
  update public.inventory
  set quantity = quantity + new.quantity,
      updated_at = now()
  where id = new.inventory_id;
  return new;
end;
$$;

create trigger stock_transaction_apply
  after insert on public.stock_transactions
  for each row execute function public.apply_stock_transaction();

-- Work order parts
create table public.work_order_parts (
  id            uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  inventory_id  uuid references public.inventory(id),
  description   text not null,
  quantity      numeric not null,
  unit_cost     numeric
);

alter table public.work_order_parts enable row level security;

create policy "Authenticated users can read work order parts"
  on public.work_order_parts for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert work order parts"
  on public.work_order_parts for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update work order parts"
  on public.work_order_parts for update using (auth.role() = 'authenticated');
