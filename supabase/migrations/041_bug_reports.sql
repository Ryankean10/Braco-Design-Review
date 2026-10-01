-- 041 — Bug reports from GridGate Assistant

CREATE TABLE IF NOT EXISTS public.bug_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_at     timestamptz NOT NULL DEFAULT now(),
  reporter_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_name   text,
  reporter_email  text,
  user_message    text NOT NULL,
  summary         text NOT NULL,
  suggested_actions jsonb DEFAULT '[]'::jsonb,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolved_at     timestamptz,
  resolved_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_by_name text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Only admins can read/update; service role handles inserts from the API
CREATE POLICY "bug_reports_admin_select" ON public.bug_reports
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "bug_reports_admin_update" ON public.bug_reports
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
