-- Add category and voltage_kv to person_credentials for HV electrical competence tracking
ALTER TABLE public.person_credentials
  ADD COLUMN IF NOT EXISTS category   text,
  ADD COLUMN IF NOT EXISTS voltage_kv text;
