-- RFI / TQ tracker
create table if not exists rfis_tqs (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references projects(id) on delete cascade,
  company_id            uuid references companies(id),

  -- Identity
  type                  text not null check (type in ('RFI','TQ')) default 'TQ',
  number                text not null,  -- e.g. SHAPE-KILW-TQ-005
  title                 text not null,

  -- Contacts
  to_contact            text,           -- e.g. "Calum Burns / Romina Aliaj"
  from_contact          text,           -- e.g. "Stephen Lynch / Robbie Foubister"
  contractor_name       text,

  -- Part 1 — Query
  date_sent             date,
  date_received         date,
  document_reference    text,
  document_title        text,
  description           text,           -- full narrative

  -- Part 2 — Possible solutions
  possible_solutions    jsonb,          -- [{solution, cost_impact, programme_impact}]

  -- Part 3 — Proposed solution
  proposed_solution     text,
  cost_impact           text,
  programme_impact      text,
  is_scope_change       boolean default false,
  response_required_by  date,           -- "programme impact if no response by"

  -- Workflow
  status                text not null default 'received'
                          check (status in ('received','submitted','response_received','sent_to_team','closed')),
  response_sla_days     int check (response_sla_days in (1,3,5,10,14)),
  submitted_to_client_at timestamptz,
  sla_expires_at        timestamptz,    -- computed: submitted_to_client_at + response_sla_days
  response_received_at  timestamptz,
  client_response       text,           -- Part 4
  sent_to_team_at       timestamptz,
  closed_at             timestamptz,

  created_by            uuid references auth.users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Audit trail for every field change
create table if not exists rfi_tq_audit_log (
  id          uuid primary key default gen_random_uuid(),
  rfi_tq_id   uuid not null references rfis_tqs(id) on delete cascade,
  user_id     uuid references auth.users(id),
  user_name   text,
  action      text not null,  -- 'created' | 'status_changed' | 'field_updated'
  changes     jsonb,          -- [{field, old_value, new_value}]
  created_at  timestamptz not null default now()
);

-- Indexes
create index if not exists rfis_tqs_project_id_idx on rfis_tqs(project_id);
create index if not exists rfis_tqs_status_idx     on rfis_tqs(status);
create index if not exists rfi_tq_audit_rfi_id_idx on rfi_tq_audit_log(rfi_tq_id);

-- Auto-update updated_at
create or replace function update_rfis_tqs_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists rfis_tqs_updated_at on rfis_tqs;
create trigger rfis_tqs_updated_at
  before update on rfis_tqs
  for each row execute function update_rfis_tqs_updated_at();

-- RLS
alter table rfis_tqs        enable row level security;
alter table rfi_tq_audit_log enable row level security;

-- Internal users see their company's records
create policy "rfis_tqs_select" on rfis_tqs for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and (p.company_id = rfis_tqs.company_id or p.role = 'superadmin')
    )
  );

create policy "rfis_tqs_insert" on rfis_tqs for insert
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = rfis_tqs.company_id
    )
  );

create policy "rfis_tqs_update" on rfis_tqs for update
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and (p.company_id = rfis_tqs.company_id or p.role = 'superadmin')
    )
  );

create policy "rfi_tq_audit_select" on rfi_tq_audit_log for select
  using (
    exists (
      select 1 from rfis_tqs r
      join profiles p on p.id = auth.uid()
      where r.id = rfi_tq_audit_log.rfi_tq_id
        and (p.company_id = r.company_id or p.role = 'superadmin')
    )
  );

create policy "rfi_tq_audit_insert" on rfi_tq_audit_log for insert
  with check (true);
