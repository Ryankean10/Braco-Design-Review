-- In-app notifications (document review requests, etc.)

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  project_id  uuid references public.projects(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  type        text not null,   -- 'document_review_requested'
  title       text not null,
  body        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.notifications enable row level security;

-- Users can only see their own notifications
create policy "Users read own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Authenticated insert notifications"
  on public.notifications for insert
  with check (auth.role() = 'authenticated');

create policy "Users update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

-- Index for fast unread count
create index if not exists notifications_user_unread
  on public.notifications (user_id, read_at)
  where read_at is null;
