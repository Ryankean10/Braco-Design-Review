-- Ensure the documents storage bucket exists (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800, -- 50 MB
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- storage.objects RLS policies for the documents bucket
-- INSERT/UPDATE/DELETE restricted to internal users, matching documents_company_write table policy.
-- SELECT open to all authenticated users so clients can access signed URLs.

CREATE POLICY "documents storage insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND auth.uid() IS NOT NULL
    AND public.is_internal()
  );

CREATE POLICY "documents storage select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "documents storage update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'documents'
    AND auth.uid() IS NOT NULL
    AND public.is_internal()
  );

CREATE POLICY "documents storage delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documents'
    AND auth.uid() IS NOT NULL
    AND public.is_internal()
  );
