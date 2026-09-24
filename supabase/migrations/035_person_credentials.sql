-- Credentials & competencies stored against a person
CREATE TABLE IF NOT EXISTS public.person_credentials (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id     uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  credential_type text NOT NULL DEFAULT 'certification',
  -- e.g. 'certification' | 'competency' | 'authorisation' | 'ticket'
  name          text NOT NULL,
  issuer        text,
  reference     text,   -- cert number / card number
  issue_date    date,
  expiry_date   date,
  notes         text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creds_person_idx ON public.person_credentials(person_id);
CREATE INDEX IF NOT EXISTS creds_expiry_idx ON public.person_credentials(expiry_date);

-- Certificate files uploaded against a credential or directly against a person
CREATE TABLE IF NOT EXISTS public.person_certificates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id     uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  credential_id uuid REFERENCES public.person_credentials(id) ON DELETE CASCADE,
  file_name     text NOT NULL,
  storage_path  text NOT NULL,
  uploaded_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS certs_person_idx   ON public.person_certificates(person_id);
CREATE INDEX IF NOT EXISTS certs_cred_idx     ON public.person_certificates(credential_id);

-- RLS
ALTER TABLE public.person_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read credentials"  ON public.person_credentials FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth write credentials" ON public.person_credentials FOR ALL    USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth read certificates"  ON public.person_certificates FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth write certificates" ON public.person_certificates FOR ALL    USING (auth.uid() IS NOT NULL);
