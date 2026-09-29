CREATE TABLE public.compliance_documents (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title            text        NOT NULL,
  category         text        NOT NULL DEFAULT 'Other'
                               CHECK (category IN (
                                 'Insurance', 'IR35', 'Certification',
                                 'H&S Accreditation', 'Legal', 'Other')),
  description      text,
  reference_number text,
  issuing_body     text,
  issue_date       date,
  expiry_date      date,
  cost_amount      numeric(10,2),
  cost_currency    text        NOT NULL DEFAULT 'GBP',
  doc_storage_path text,
  doc_file_name    text,
  doc_file_size    bigint,
  created_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.compliance_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_company_read" ON public.compliance_documents
  FOR SELECT USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR public.is_superadmin()
  );

CREATE POLICY "compliance_admin_write" ON public.compliance_documents
  FOR ALL USING (
    (
      company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
      AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    )
    OR public.is_superadmin()
  );
