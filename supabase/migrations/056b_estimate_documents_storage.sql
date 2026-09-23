-- Run this in Supabase SQL Editor OR use the Storage UI to create the bucket manually

-- Create the storage bucket (requires Storage API or dashboard)
-- In Supabase Dashboard > Storage > New bucket:
--   Name: estimate-documents
--   Public: false

-- Storage policies (run in SQL Editor after bucket is created)
INSERT INTO storage.buckets (id, name, public) VALUES ('estimate-documents', 'estimate-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "superadmin_storage_all" ON storage.objects FOR ALL USING (
  bucket_id = 'estimate-documents' AND is_superadmin()
);

CREATE POLICY "company_storage_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'estimate-documents'
  AND auth.uid() IN (
    SELECT p.id FROM public.profiles p
    JOIN public.estimates e ON e.company_id = p.company_id
    WHERE ('estimates/' || e.id::text) = split_part(storage.objects.name, '/', 1) || '/' || split_part(storage.objects.name, '/', 2)
  )
);
