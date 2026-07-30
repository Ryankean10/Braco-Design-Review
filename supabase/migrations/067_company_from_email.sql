-- Migration 067: Add notification sender email to companies

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS from_email text;

-- Set known values
UPDATE public.companies SET from_email = 'admin@safetconsultancy.com' WHERE slug = 'braco';
UPDATE public.companies SET from_email = 'scotplantai@yacht-gitana.com' WHERE slug = 'scotplant';
