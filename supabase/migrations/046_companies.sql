-- 046: Multi-tenancy — companies table + profiles company_id

-- ── Companies (tenants) ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.companies (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  slug       text        NOT NULL UNIQUE, -- subdomain: 'braco', 'ocugroup'
  logo_url   text,
  modules    text[]      NOT NULL DEFAULT ARRAY[
                           'projects', 'documents', 'reviews', 'reference_library'
                         ],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Braco is the founding tenant — all modules enabled (dev sandbox)
INSERT INTO public.companies (name, slug, modules)
VALUES (
  'Braco',
  'braco',
  ARRAY[
    'projects', 'documents', 'reviews', 'reference_library',
    'procurement', 'tests', 'assurance', 'construction', 'planning', 'team'
  ]
) ON CONFLICT (slug) DO NOTHING;

-- ── Add company_id to profiles ─────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

-- Backfill all existing users → Braco
UPDATE public.profiles
SET company_id = (SELECT id FROM public.companies WHERE slug = 'braco')
WHERE company_id IS NULL;

-- ── Add superadmin role ────────────────────────────────────────────────────────

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('superadmin', 'admin', 'engineer', 'project_manager', 'operative', 'client'));

-- ── Helper functions ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin'
  )
$$;

-- Update is_internal and is_manager to include superadmin
CREATE OR REPLACE FUNCTION public.is_internal()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('superadmin', 'admin', 'engineer', 'project_manager', 'operative')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('superadmin', 'admin', 'engineer', 'project_manager')
  )
$$;

-- ── Trigger: auto-assign company on new user signup ───────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company_id uuid;
BEGIN
  -- Resolve company from metadata slug, fallback to braco
  SELECT id INTO v_company_id
  FROM public.companies
  WHERE slug = COALESCE(new.raw_user_meta_data->>'company_slug', 'braco')
  LIMIT 1;

  INSERT INTO public.profiles (id, email, full_name, role, company_id)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    COALESCE(new.raw_user_meta_data->>'role', 'engineer'),
    v_company_id
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ── RLS on companies ───────────────────────────────────────────────────────────

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companies_own_read"      ON public.companies;
DROP POLICY IF EXISTS "companies_superadmin_all" ON public.companies;

CREATE POLICY "companies_own_read" ON public.companies
  FOR SELECT
  USING (id = public.get_user_company_id() OR public.is_superadmin());

CREATE POLICY "companies_superadmin_all" ON public.companies
  FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- ── Updated profiles RLS ───────────────────────────────────────────────────────
-- Allow users to read other profiles in their own company (needed for team panels)

DROP POLICY IF EXISTS "Users can read own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"  ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles"  ON public.profiles;
DROP POLICY IF EXISTS "internal_read_profiles"        ON public.profiles;

CREATE POLICY "profiles_company_read" ON public.profiles
  FOR SELECT
  USING (
    auth.uid() = id
    OR company_id = public.get_user_company_id()
    OR public.is_superadmin()
  );

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id OR public.is_superadmin());

CREATE POLICY "profiles_superadmin_all" ON public.profiles
  FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());
