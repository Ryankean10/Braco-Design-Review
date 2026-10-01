-- 048 — Add report_type and priority to bug_reports

ALTER TABLE public.bug_reports
  ADD COLUMN IF NOT EXISTS report_type text NOT NULL DEFAULT 'bug'
    CHECK (report_type IN ('bug', 'suggestion')),
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical'));
