-- Storage bucket: private, isolated from all other company buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('client-templates', 'client-templates', false, 52428800)  -- 50 MB per file
ON CONFLICT (id) DO NOTHING;

-- Metadata table for uploaded client templates
CREATE TABLE IF NOT EXISTS public.client_template_uploads (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid        REFERENCES public.companies(id) ON DELETE SET NULL,
  company_slug text        NOT NULL,
  file_name    text        NOT NULL,
  description  text        NOT NULL,
  storage_path text        NOT NULL,
  uploaded_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_template_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_all" ON public.client_template_uploads
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- Storage: superadmins can read files; uploads are always via service-role key (bypasses RLS)
CREATE POLICY "superadmin_read_client_templates" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'client-templates'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin')
  );
