-- Storage bucket for agency timesheet XLS files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'timesheets',
  'timesheets',
  false,
  10485760, -- 10 MB
  ARRAY['application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload and read
CREATE POLICY "auth upload timesheets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'timesheets' AND auth.uid() IS NOT NULL);

CREATE POLICY "auth read timesheets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'timesheets' AND auth.uid() IS NOT NULL);

CREATE POLICY "auth delete timesheets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'timesheets' AND auth.uid() IS NOT NULL);
