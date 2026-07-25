-- Budget codes / cost centres
create table public.budget_codes (
  id               uuid primary key default gen_random_uuid(),
  vessel_id        uuid not null references public.vessels(id) on delete cascade,
  code             text not null,
  name             text not null,
  category         text not null check (category in ('opex','capex')),
  year             integer not null,
  allocated_amount numeric not null default 0,
  notes            text,
  unique (vessel_id, code, year)
);

alter table public.budget_codes enable row level security;

create policy "Authenticated users can read budget codes"
  on public.budget_codes for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert budget codes"
  on public.budget_codes for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update budget codes"
  on public.budget_codes for update using (auth.role() = 'authenticated');

-- Now add FK from work_orders and purchase_orders
alter table public.work_orders
  add constraint fk_wo_budget_code
  foreign key (budget_code_id) references public.budget_codes(id);

alter table public.purchase_orders
  add constraint fk_po_budget_code
  foreign key (budget_code_id) references public.budget_codes(id);

-- Expenses / cost entries
create table public.expenses (
  id             uuid primary key default gen_random_uuid(),
  vessel_id      uuid not null references public.vessels(id) on delete cascade,
  budget_code_id uuid references public.budget_codes(id),
  date           date not null,
  amount         numeric not null,
  currency       text not null default 'USD',
  exchange_rate  numeric not null default 1,
  amount_usd     numeric not null,
  description    text not null,
  vendor         text,
  work_order_id  uuid references public.work_orders(id),
  po_id          uuid references public.purchase_orders(id),
  invoice_no     text,
  receipt_path   text,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now()
);

alter table public.expenses enable row level security;

create policy "Authenticated users can read expenses"
  on public.expenses for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert expenses"
  on public.expenses for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update expenses"
  on public.expenses for update using (auth.role() = 'authenticated');

-- Budget utilisation view
create view public.budget_utilization as
  select
    bc.id,
    bc.vessel_id,
    bc.code,
    bc.name,
    bc.category,
    bc.year,
    bc.allocated_amount,
    coalesce(sum(e.amount_usd), 0) as spent,
    bc.allocated_amount - coalesce(sum(e.amount_usd), 0) as remaining,
    case
      when bc.allocated_amount = 0 then 0::numeric
      else round((coalesce(sum(e.amount_usd), 0) / bc.allocated_amount * 100)::numeric, 1)
    end as utilization_pct
  from public.budget_codes bc
  left join public.expenses e
    on e.budget_code_id = bc.id
    and extract(year from e.date) = bc.year
  group by bc.id;
