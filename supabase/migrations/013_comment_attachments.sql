-- Attachments on client comments (both the original comment and responses)
create table if not exists public.comment_attachments (
  id           uuid primary key default gen_random_uuid(),
  comment_id   uuid not null references public.client_comments(id) on delete cascade,
  storage_path text not null,
  file_name    text not null,
  file_size    integer,
  -- 'comment' = attached to the original comment, 'response' = attached to the response
  attached_to  text not null default 'comment' check (attached_to in ('comment','response')),
  uploaded_by  uuid references auth.users(id),
  uploaded_at  timestamptz not null default now()
);

alter table public.comment_attachments enable row level security;

-- Clients can attach to their own comments
create policy "Client attach to own comment" on public.comment_attachments for insert
  with check (
    exists (
      select 1 from public.client_comments cc
      where cc.id = comment_id and cc.created_by = auth.uid()
    )
  );

-- Internal team can attach responses
create policy "Internal attach response" on public.comment_attachments for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid()
      and role in ('admin','project_manager','engineer'))
  );

-- All authenticated can read attachments
create policy "Auth read attachments" on public.comment_attachments for select
  using (auth.role() = 'authenticated');

-- Uploader can delete their own attachment
create policy "Uploader delete attachment" on public.comment_attachments for delete
  using (uploaded_by = auth.uid());
