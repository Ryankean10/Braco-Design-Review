-- ============================================================
-- 045: Access control hardening
-- Restricts personnel, timesheet, and credential data to
-- internal roles only (admin, engineer, project_manager, operative).
-- Clients are blocked at the RLS level, not just the API level.
-- ============================================================

-- Helper: returns true if the current user is NOT a client
CREATE OR REPLACE FUNCTION auth.is_internal()
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'engineer', 'project_manager', 'operative')
  )
$$;

CREATE OR REPLACE FUNCTION auth.is_manager()
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'engineer', 'project_manager')
  )
$$;

-- ── people ──────────────────────────────────────────────────
-- Currently: all authenticated. Change to: internal only.
DROP POLICY IF EXISTS "people_read" ON public.people;
DROP POLICY IF EXISTS "people_write" ON public.people;
DROP POLICY IF EXISTS "People are viewable by authenticated users" ON public.people;
DROP POLICY IF EXISTS "People are manageable by admins" ON public.people;

CREATE POLICY "people_read" ON public.people
  FOR SELECT TO authenticated
  USING (auth.is_internal());

CREATE POLICY "people_write" ON public.people
  FOR ALL TO authenticated
  USING (auth.is_manager())
  WITH CHECK (auth.is_manager());

-- ── person_credentials ──────────────────────────────────────
DROP POLICY IF EXISTS "person_credentials_all" ON public.person_credentials;
DROP POLICY IF EXISTS "Credentials readable by authenticated users" ON public.person_credentials;

CREATE POLICY "credentials_read" ON public.person_credentials
  FOR SELECT TO authenticated
  USING (auth.is_manager());

CREATE POLICY "credentials_write" ON public.person_credentials
  FOR ALL TO authenticated
  USING (auth.is_manager())
  WITH CHECK (auth.is_manager());

-- ── person_certificates ─────────────────────────────────────
DROP POLICY IF EXISTS "person_certificates_all" ON public.person_certificates;
DROP POLICY IF EXISTS "Certificates readable by authenticated users" ON public.person_certificates;

CREATE POLICY "certificates_read" ON public.person_certificates
  FOR SELECT TO authenticated
  USING (auth.is_manager());

CREATE POLICY "certificates_write" ON public.person_certificates
  FOR ALL TO authenticated
  USING (auth.is_manager())
  WITH CHECK (auth.is_manager());

-- ── timesheets ──────────────────────────────────────────────
DROP POLICY IF EXISTS "timesheets_all" ON public.timesheets;
DROP POLICY IF EXISTS "Timesheets readable by authenticated users" ON public.timesheets;

CREATE POLICY "timesheets_read" ON public.timesheets
  FOR SELECT TO authenticated
  USING (auth.is_manager());

CREATE POLICY "timesheets_write" ON public.timesheets
  FOR ALL TO authenticated
  USING (auth.is_manager())
  WITH CHECK (auth.is_manager());

-- ── timesheet_entries ────────────────────────────────────────
DROP POLICY IF EXISTS "timesheet_entries_all" ON public.timesheet_entries;
DROP POLICY IF EXISTS "Timesheet entries readable by authenticated users" ON public.timesheet_entries;

CREATE POLICY "ts_entries_read" ON public.timesheet_entries
  FOR SELECT TO authenticated
  USING (auth.is_manager());

CREATE POLICY "ts_entries_write" ON public.timesheet_entries
  FOR ALL TO authenticated
  USING (auth.is_manager())
  WITH CHECK (auth.is_manager());

-- ── diary_name_mappings ──────────────────────────────────────
DROP POLICY IF EXISTS "diary_name_mappings_all" ON public.diary_name_mappings;
DROP POLICY IF EXISTS "Diary name mappings readable by authenticated users" ON public.diary_name_mappings;

CREATE POLICY "diary_mappings_read" ON public.diary_name_mappings
  FOR SELECT TO authenticated
  USING (auth.is_manager());

CREATE POLICY "diary_mappings_write" ON public.diary_name_mappings
  FOR ALL TO authenticated
  USING (auth.is_manager())
  WITH CHECK (auth.is_manager());

-- ── site_daily_logs — block client reads ────────────────────
-- (construction_sites RLS already blocks clients; add belt-and-braces here)
DROP POLICY IF EXISTS "daily_logs_all" ON public.site_daily_logs;
DROP POLICY IF EXISTS "Site daily logs readable by authenticated users" ON public.site_daily_logs;

CREATE POLICY "daily_logs_read" ON public.site_daily_logs
  FOR SELECT TO authenticated
  USING (auth.is_internal());

CREATE POLICY "daily_logs_write" ON public.site_daily_logs
  FOR ALL TO authenticated
  USING (auth.is_internal())
  WITH CHECK (auth.is_internal());

-- ── Add ai_flags column to site_daily_logs (if not already added) ──
ALTER TABLE public.site_daily_logs
  ADD COLUMN IF NOT EXISTS ai_flags jsonb NOT NULL DEFAULT '[]';
