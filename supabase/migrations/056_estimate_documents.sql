CREATE TABLE public.estimate_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id  uuid REFERENCES public.estimates(id) ON DELETE CASCADE,
  name         text NOT NULL,
  storage_path text NOT NULL,
  file_size    integer,
  file_type    text,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.estimate_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_all" ON public.estimate_documents FOR ALL USING (is_superadmin());
CREATE POLICY "company_docs" ON public.estimate_documents
  FOR ALL USING (
    estimate_id IN (
      SELECT e.id FROM public.estimates e
      JOIN public.profiles p ON p.company_id = e.company_id
      WHERE p.id = auth.uid()
    )
  );
