-- Add cert_standard and issuing_client to person_credentials
-- cert_standard: specific standard type (SAP authorisation, ECS, CSCS, etc.)
-- issuing_client: for SAP authorisations — the client/employer that granted it

ALTER TABLE public.person_credentials
  ADD COLUMN IF NOT EXISTS cert_standard text,
  ADD COLUMN IF NOT EXISTS issuing_client text;

COMMENT ON COLUMN public.person_credentials.cert_standard IS
  'Specific standard type: SAP authorisation | ECS | CSCS | IPAF | CCNSG | GWO | offshore medical | calibration | other';
COMMENT ON COLUMN public.person_credentials.issuing_client IS
  'For SAP authorisations: the client/employer that issued it (e.g. SP Energy Networks)';
