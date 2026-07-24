-- 047: Tenant isolation — company_id on core tables + triggers + updated RLS
--
-- Strategy:
--   • Add company_id directly to the 3 top-level tenant tables:
--       projects, construction_sites, people
--   • All child tables (documents, findings, cable_items, timesheets etc.)
--       inherit isolation via EXISTS check through their parent FK
--   • Trigger auto-sets company_id from the user's profile on INSERT
--   • is_superadmin() bypasses all company checks

-- ── Helper functions for child-table RLS ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.user_can_access_project(p_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id
    AND (company_id = public.get_user_company_id() OR public.is_superadmin())
  )
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_site(p_site_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.construction_sites
    WHERE id = p_site_id
    AND (company_id = public.get_user_company_id() OR public.is_superadmin())
  )
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_person(p_person_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.people
    WHERE id = p_person_id
    AND (company_id = public.get_user_company_id() OR public.is_superadmin())
  )
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PROJECTS
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

UPDATE public.projects
SET company_id = (SELECT id FROM public.companies WHERE slug = 'braco')
WHERE company_id IS NULL;

-- Trigger: auto-set company_id on INSERT
CREATE OR REPLACE FUNCTION public.set_company_id_from_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT company_id INTO NEW.company_id
    FROM public.profiles WHERE id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_project_company ON public.projects;
CREATE TRIGGER set_project_company
  BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_profile();

-- RLS
DROP POLICY IF EXISTS "Authenticated users can read projects"   ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can insert projects"  ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can update projects"  ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can delete projects"  ON public.projects;
DROP POLICY IF EXISTS "projects_company_read"  ON public.projects;
DROP POLICY IF EXISTS "projects_company_write" ON public.projects;

CREATE POLICY "projects_company_select" ON public.projects
  FOR SELECT USING (company_id = public.get_user_company_id() OR public.is_superadmin());

CREATE POLICY "projects_company_insert" ON public.projects
  FOR INSERT WITH CHECK (company_id = public.get_user_company_id() OR public.is_superadmin());

CREATE POLICY "projects_company_update" ON public.projects
  FOR UPDATE USING (company_id = public.get_user_company_id() OR public.is_superadmin());

CREATE POLICY "projects_company_delete" ON public.projects
  FOR DELETE USING (company_id = public.get_user_company_id() OR public.is_superadmin());

-- ═══════════════════════════════════════════════════════════════════════════════
-- CONSTRUCTION SITES
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.construction_sites
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

UPDATE public.construction_sites
SET company_id = (SELECT id FROM public.companies WHERE slug = 'braco')
WHERE company_id IS NULL;

DROP TRIGGER IF EXISTS set_construction_site_company ON public.construction_sites;
CREATE TRIGGER set_construction_site_company
  BEFORE INSERT ON public.construction_sites
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_profile();

ALTER TABLE public.construction_sites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "construction_sites_company_select" ON public.construction_sites;
DROP POLICY IF EXISTS "construction_sites_company_all"    ON public.construction_sites;

CREATE POLICY "construction_sites_company_select" ON public.construction_sites
  FOR SELECT USING (company_id = public.get_user_company_id() OR public.is_superadmin());

CREATE POLICY "construction_sites_company_insert" ON public.construction_sites
  FOR INSERT WITH CHECK ((company_id = public.get_user_company_id() OR public.is_superadmin()) AND public.is_manager());

CREATE POLICY "construction_sites_company_update" ON public.construction_sites
  FOR UPDATE USING ((company_id = public.get_user_company_id() OR public.is_superadmin()) AND public.is_manager());

CREATE POLICY "construction_sites_company_delete" ON public.construction_sites
  FOR DELETE USING (public.is_manager());

-- ═══════════════════════════════════════════════════════════════════════════════
-- PEOPLE
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

UPDATE public.people
SET company_id = (SELECT id FROM public.companies WHERE slug = 'braco')
WHERE company_id IS NULL;

DROP TRIGGER IF EXISTS set_person_company ON public.people;
CREATE TRIGGER set_person_company
  BEFORE INSERT ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_profile();

ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "people_read"           ON public.people;
DROP POLICY IF EXISTS "people_write"          ON public.people;
DROP POLICY IF EXISTS "internal_read_people"  ON public.people;
DROP POLICY IF EXISTS "manager_write_people"  ON public.people;
DROP POLICY IF EXISTS "people_company_select" ON public.people;
DROP POLICY IF EXISTS "people_company_all"    ON public.people;

CREATE POLICY "people_company_select" ON public.people
  FOR SELECT USING (company_id = public.get_user_company_id() OR public.is_superadmin());

CREATE POLICY "people_company_insert" ON public.people
  FOR INSERT WITH CHECK ((company_id = public.get_user_company_id() OR public.is_superadmin()) AND public.is_internal());

CREATE POLICY "people_company_update" ON public.people
  FOR UPDATE USING ((company_id = public.get_user_company_id() OR public.is_superadmin()) AND public.is_manager());

CREATE POLICY "people_company_delete" ON public.people
  FOR DELETE USING (public.is_manager());

-- ═══════════════════════════════════════════════════════════════════════════════
-- CHILD TABLES — project-scoped (isolation via user_can_access_project)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "documents_company_read"  ON public.documents;
DROP POLICY IF EXISTS "documents_company_write" ON public.documents;
CREATE POLICY "documents_company_read" ON public.documents
  FOR SELECT USING (public.user_can_access_project(project_id));
CREATE POLICY "documents_company_write" ON public.documents
  FOR ALL USING (public.user_can_access_project(project_id) AND public.is_internal());

-- Project stages
ALTER TABLE public.project_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_stages_company" ON public.project_stages;
CREATE POLICY "project_stages_company" ON public.project_stages
  FOR ALL USING (public.user_can_access_project(project_id));

-- Project members
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_members_company" ON public.project_members;
CREATE POLICY "project_members_company" ON public.project_members
  FOR ALL USING (public.user_can_access_project(project_id));

-- Project clients
ALTER TABLE public.project_clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_clients_company" ON public.project_clients;
CREATE POLICY "project_clients_company" ON public.project_clients
  FOR ALL USING (public.user_can_access_project(project_id));

-- Project standards links
ALTER TABLE public.project_standards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_standards_company" ON public.project_standards;
CREATE POLICY "project_standards_company" ON public.project_standards
  FOR ALL USING (public.user_can_access_project(project_id));

-- Design review findings
ALTER TABLE public.design_review_findings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "findings_company" ON public.design_review_findings;
CREATE POLICY "findings_company" ON public.design_review_findings
  FOR ALL USING (public.user_can_access_project(project_id));

-- Design decision log
ALTER TABLE public.design_decision_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "decision_log_company" ON public.design_decision_log;
CREATE POLICY "decision_log_company" ON public.design_decision_log
  FOR ALL USING (public.user_can_access_project(project_id));

-- Test register
ALTER TABLE public.test_register ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "test_register_company" ON public.test_register;
CREATE POLICY "test_register_company" ON public.test_register
  FOR ALL USING (public.user_can_access_project(project_id));

-- Work planner forecasts
ALTER TABLE public.work_planner_forecasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "work_planner_company" ON public.work_planner_forecasts;
CREATE POLICY "work_planner_company" ON public.work_planner_forecasts
  FOR ALL USING (public.user_can_access_project(project_id));

-- Client comments
ALTER TABLE public.client_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "client_comments_company" ON public.client_comments;
CREATE POLICY "client_comments_company" ON public.client_comments
  FOR ALL USING (public.user_can_access_project(project_id));

-- Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_own" ON public.notifications;
CREATE POLICY "notifications_own" ON public.notifications
  FOR ALL USING (user_id = auth.uid() OR public.is_superadmin());

-- QCS documents (project-scoped)
ALTER TABLE public.qcs_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "qcs_documents_company" ON public.qcs_documents;
CREATE POLICY "qcs_documents_company" ON public.qcs_documents
  FOR ALL USING (public.user_can_access_project(project_id));

-- Technical documents
ALTER TABLE public.technical_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "technical_documents_company" ON public.technical_documents;
CREATE POLICY "technical_documents_company" ON public.technical_documents
  FOR ALL USING (public.user_can_access_project(project_id));

-- Project ITP uploads
ALTER TABLE public.project_itp_uploads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_itp_company" ON public.project_itp_uploads;
CREATE POLICY "project_itp_company" ON public.project_itp_uploads
  FOR ALL USING (public.user_can_access_project(project_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- CHILD TABLES — site-scoped (isolation via user_can_access_site)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Site daily logs
ALTER TABLE public.site_daily_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "site_daily_logs_company" ON public.site_daily_logs;
CREATE POLICY "site_daily_logs_company" ON public.site_daily_logs
  FOR ALL USING (public.user_can_access_site(site_id) AND public.is_internal());

-- Diary name mappings
ALTER TABLE public.diary_name_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "diary_name_mappings_company" ON public.diary_name_mappings;
CREATE POLICY "diary_name_mappings_company" ON public.diary_name_mappings
  FOR ALL USING (public.user_can_access_site(site_id) AND public.is_internal());

-- Timesheets
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "timesheets_company"           ON public.timesheets;
DROP POLICY IF EXISTS "internal_read_timesheets"     ON public.timesheets;
DROP POLICY IF EXISTS "manager_write_timesheets"     ON public.timesheets;
CREATE POLICY "timesheets_company" ON public.timesheets
  FOR ALL USING (public.user_can_access_site(site_id) AND public.is_internal());

-- Timesheet entries
ALTER TABLE public.timesheet_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "timesheet_entries_company"      ON public.timesheet_entries;
DROP POLICY IF EXISTS "internal_read_timesheet_entries" ON public.timesheet_entries;
DROP POLICY IF EXISTS "manager_write_timesheet_entries" ON public.timesheet_entries;
CREATE POLICY "timesheet_entries_company" ON public.timesheet_entries
  FOR ALL USING (public.user_can_access_site(site_id) AND public.is_internal());

-- Cable items (via site_id on cable_items)
ALTER TABLE public.cable_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cable_items_company" ON public.cable_items;
CREATE POLICY "cable_items_company" ON public.cable_items
  FOR ALL USING (public.user_can_access_site(site_id));

-- Construction packages
ALTER TABLE public.construction_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "construction_packages_company" ON public.construction_packages;
CREATE POLICY "construction_packages_company" ON public.construction_packages
  FOR ALL USING (public.user_can_access_site(site_id));

-- Civils activities
ALTER TABLE public.civils_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "civils_activities_company" ON public.civils_activities;
CREATE POLICY "civils_activities_company" ON public.civils_activities
  FOR ALL USING (public.user_can_access_site(site_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- PEOPLE CHILD TABLES — scoped via user_can_access_person
-- ═══════════════════════════════════════════════════════════════════════════════

-- Job appointments
ALTER TABLE public.job_appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "job_appointments_company" ON public.job_appointments;
CREATE POLICY "job_appointments_company" ON public.job_appointments
  FOR ALL USING (public.user_can_access_person(person_id) AND public.is_internal());

-- Person credentials
ALTER TABLE public.person_credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "internal_read_credentials"  ON public.person_credentials;
DROP POLICY IF EXISTS "manager_write_credentials"  ON public.person_credentials;
DROP POLICY IF EXISTS "person_credentials_company" ON public.person_credentials;
CREATE POLICY "person_credentials_company" ON public.person_credentials
  FOR ALL USING (public.user_can_access_person(person_id) AND public.is_internal());

-- Person certificates
ALTER TABLE public.person_certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "internal_read_certificates"  ON public.person_certificates;
DROP POLICY IF EXISTS "manager_write_certificates"  ON public.person_certificates;
DROP POLICY IF EXISTS "person_certificates_company" ON public.person_certificates;
CREATE POLICY "person_certificates_company" ON public.person_certificates
  FOR ALL USING (public.user_can_access_person(person_id) AND public.is_internal());

-- ═══════════════════════════════════════════════════════════════════════════════
-- GLOBAL TABLES — no company isolation (shared across all tenants)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Standards library: globally shared, read by all authenticated users
ALTER TABLE public.standards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "standards_global_read"  ON public.standards;
DROP POLICY IF EXISTS "standards_admin_write"  ON public.standards;
CREATE POLICY "standards_global_read" ON public.standards
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "standards_admin_write" ON public.standards
  FOR ALL USING (public.is_superadmin());

-- QCS templates: shared baseline, superadmin-managed
ALTER TABLE public.qcs_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "qcs_templates_global_read" ON public.qcs_templates;
DROP POLICY IF EXISTS "qcs_templates_admin_write" ON public.qcs_templates;
CREATE POLICY "qcs_templates_global_read" ON public.qcs_templates
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "qcs_templates_admin_write" ON public.qcs_templates
  FOR ALL USING (public.is_superadmin());

-- Lessons learned: per-company (use project isolation for project-linked lessons)
-- NOTE: if lessons_learned has no project_id, add company_id directly
-- Check migration 008 for exact schema — adjust if needed
