create table if not exists rfi_tq_attachments (
  id           uuid primary key default gen_random_uuid(),
  rfi_tq_id    uuid not null references rfis_tqs(id) on delete cascade,
  project_id   uuid not null references projects(id) on delete cascade,
  storage_path text not null,
  file_name    text not null,
  mime_type    text,
  size_bytes   bigint,
  uploaded_by  uuid references auth.users(id),
  uploaded_at  timestamptz not null default now()
);

create index if not exists rfi_tq_attachments_rfi_id_idx on rfi_tq_attachments(rfi_tq_id);

alter table rfi_tq_attachments enable row level security;

create policy "rfi_tq_att_select" on rfi_tq_attachments for select
  using (
    exists (
      select 1 from rfis_tqs r
      join profiles p on p.id = auth.uid()
      where r.id = rfi_tq_attachments.rfi_tq_id
        and (p.company_id = r.company_id or p.role = 'superadmin')
    )
  );

create policy "rfi_tq_att_insert" on rfi_tq_attachments for insert
  with check (auth.uid() is not null);

create policy "rfi_tq_att_delete" on rfi_tq_attachments for delete
  using (auth.uid() = uploaded_by or exists (
    select 1 from profiles where id = auth.uid() and role in ('superadmin','admin')
  ));
