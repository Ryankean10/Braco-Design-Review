-- Suppliers
create table public.suppliers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  contact_name  text,
  email         text,
  phone         text,
  address       text,
  country       text,
  categories    text[],
  payment_terms text,
  currency      text default 'USD',
  approved      boolean not null default false,
  rating        integer check (rating between 1 and 5),
  notes         text,
  created_at    timestamptz not null default now()
);

alter table public.suppliers enable row level security;

create policy "Authenticated users can read suppliers"
  on public.suppliers for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert suppliers"
  on public.suppliers for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update suppliers"
  on public.suppliers for update using (auth.role() = 'authenticated');

-- Requisitions
create table public.requisitions (
  id          uuid primary key default gen_random_uuid(),
  vessel_id   uuid not null references public.vessels(id) on delete cascade,
  req_number  text not null,
  title       text not null,
  status      text not null default 'draft'
                check (status in ('draft','submitted','approved','ordered',
                                  'partially_received','received','cancelled')),
  priority    text not null default 'normal' check (priority in ('urgent','normal','planned')),
  required_by date,
  notes       text,
  created_by  uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.requisitions enable row level security;

create policy "Authenticated users can read requisitions"
  on public.requisitions for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert requisitions"
  on public.requisitions for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update requisitions"
  on public.requisitions for update using (auth.role() = 'authenticated');

create trigger requisitions_updated_at before update on public.requisitions
  for each row execute function public.set_updated_at();

-- Requisition items
create table public.req_items (
  id                  uuid primary key default gen_random_uuid(),
  req_id              uuid not null references public.requisitions(id) on delete cascade,
  inventory_id        uuid references public.inventory(id),
  description         text not null,
  quantity            numeric not null,
  unit                text not null default 'each',
  estimated_unit_cost numeric,
  work_order_id       uuid references public.work_orders(id)
);

alter table public.req_items enable row level security;

create policy "Authenticated users can read req items"
  on public.req_items for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert req items"
  on public.req_items for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update req items"
  on public.req_items for update using (auth.role() = 'authenticated');

-- Purchase orders
create table public.purchase_orders (
  id                uuid primary key default gen_random_uuid(),
  vessel_id         uuid not null references public.vessels(id) on delete cascade,
  supplier_id       uuid references public.suppliers(id),
  req_id            uuid references public.requisitions(id),
  po_number         text not null,
  status            text not null default 'draft'
                      check (status in ('draft','sent','confirmed','partially_received',
                                        'received','invoiced','cancelled')),
  currency          text not null default 'USD',
  exchange_rate     numeric not null default 1,
  issue_date        date not null default current_date,
  expected_delivery date,
  delivery_address  text,
  payment_terms     text,
  total_amount      numeric,
  budget_code_id    uuid,
  invoice_no        text,
  notes             text,
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.purchase_orders enable row level security;

create policy "Authenticated users can read purchase orders"
  on public.purchase_orders for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert purchase orders"
  on public.purchase_orders for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update purchase orders"
  on public.purchase_orders for update using (auth.role() = 'authenticated');

create trigger purchase_orders_updated_at before update on public.purchase_orders
  for each row execute function public.set_updated_at();

-- PO line items
create table public.po_items (
  id                uuid primary key default gen_random_uuid(),
  po_id             uuid not null references public.purchase_orders(id) on delete cascade,
  req_item_id       uuid references public.req_items(id),
  inventory_id      uuid references public.inventory(id),
  description       text not null,
  quantity          numeric not null,
  unit              text not null default 'each',
  unit_price        numeric not null,
  received_quantity numeric not null default 0
);

alter table public.po_items enable row level security;

create policy "Authenticated users can read po items"
  on public.po_items for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert po items"
  on public.po_items for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update po items"
  on public.po_items for update using (auth.role() = 'authenticated');

-- FK link stock_transactions to POs
alter table public.stock_transactions
  add constraint fk_stock_tx_po
  foreign key (po_id) references public.purchase_orders(id);
