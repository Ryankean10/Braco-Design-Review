-- 077: Make standards, hs_references, and lessons_learned company-scoped
-- Existing rows (NULL company_id) become superadmin-only; each company starts clean.

ALTER TABLE public.standards      ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.hs_references   ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.lessons_learned ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

-- Auto-set company_id from inserting user's profile (reuses trigger fn from migration 047)
DROP TRIGGER IF EXISTS set_standard_company  ON public.standards;
DROP TRIGGER IF EXISTS set_hs_ref_company    ON public.hs_references;
DROP TRIGGER IF EXISTS set_lesson_company    ON public.lessons_learned;

CREATE TRIGGER set_standard_company BEFORE INSERT ON public.standards
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_profile();
CREATE TRIGGER set_hs_ref_company BEFORE INSERT ON public.hs_references
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_profile();
CREATE TRIGGER set_lesson_company BEFORE INSERT ON public.lessons_learned
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_profile();

-- Standards RLS
DROP POLICY IF EXISTS "standards_global_read"   ON public.standards;
DROP POLICY IF EXISTS "standards_admin_write"   ON public.standards;
DROP POLICY IF EXISTS "standards_company_read"  ON public.standards;
DROP POLICY IF EXISTS "standards_company_write" ON public.standards;

CREATE POLICY "standards_company_read" ON public.standards
  FOR SELECT USING (company_id = public.get_user_company_id() OR public.is_superadmin());
CREATE POLICY "standards_company_write" ON public.standards
  FOR ALL USING (
    (company_id = public.get_user_company_id()
     AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()
                 AND role IN ('admin','superadmin','project_manager')))
    OR public.is_superadmin()
  );

-- H&S References RLS
DROP POLICY IF EXISTS "Auth read hs_references"   ON public.hs_references;
DROP POLICY IF EXISTS "Admin mutate hs_references" ON public.hs_references;
DROP POLICY IF EXISTS "hs_refs_company_read"      ON public.hs_references;
DROP POLICY IF EXISTS "hs_refs_company_write"     ON public.hs_references;

CREATE POLICY "hs_refs_company_read" ON public.hs_references
  FOR SELECT USING (company_id = public.get_user_company_id() OR public.is_superadmin());
CREATE POLICY "hs_refs_company_write" ON public.hs_references
  FOR ALL USING (
    (company_id = public.get_user_company_id()
     AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()
                 AND role IN ('admin','superadmin','project_manager')))
    OR public.is_superadmin()
  );

-- Lessons Learned RLS
DROP POLICY IF EXISTS "Auth read lessons_learned"   ON public.lessons_learned;
DROP POLICY IF EXISTS "Admin mutate lessons_learned" ON public.lessons_learned;
DROP POLICY IF EXISTS "lessons_company_read"        ON public.lessons_learned;
DROP POLICY IF EXISTS "lessons_company_write"       ON public.lessons_learned;

CREATE POLICY "lessons_company_read" ON public.lessons_learned
  FOR SELECT USING (company_id = public.get_user_company_id() OR public.is_superadmin());
CREATE POLICY "lessons_company_write" ON public.lessons_learned
  FOR ALL USING (
    (company_id = public.get_user_company_id()
     AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()
                 AND role IN ('admin','superadmin','project_manager')))
    OR public.is_superadmin()
  );
