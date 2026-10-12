-- Add decision_type to findings and create the design decision audit log

alter table public.design_findings
  add column if not exists decision_type text
    check (decision_type in (
      'Design Change Required',
      'Accepted as Risk',
      'Deferred to Later Stage',
      'Further Investigation Required',
      'Not Applicable',
      'AI Interpretation Error',
      'Duplicate Finding',
      'Out of Scope'
    ));

-- Full audit log — one row per action on a finding
create table public.design_decision_log (
  id            uuid primary key default gen_random_uuid(),
  finding_id    uuid not null references public.design_findings(id) on delete cascade,
  project_id    uuid not null references public.projects(id) on delete cascade,
  run_id        uuid references public.design_review_runs(id),
  lens          text not null,
  finding_title text not null,
  severity      text not null,
  action        text not null
                  check (action in ('Raised','Approved','Rejected','Reopened','Note Added')),
  decision_type text,
  comment       text,
  actioned_by   uuid references auth.users(id),
  actioned_at   timestamptz not null default now()
);

alter table public.design_decision_log enable row level security;

create policy "Authenticated users can read decision log"
  on public.design_decision_log for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert decision log"
  on public.design_decision_log for insert with check (auth.role() = 'authenticated');
