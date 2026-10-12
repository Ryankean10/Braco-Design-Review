-- Add contract_review as a valid lens value on design_findings
ALTER TABLE public.design_findings
  DROP CONSTRAINT IF EXISTS design_findings_lens_check;

ALTER TABLE public.design_findings
  ADD CONSTRAINT design_findings_lens_check
  CHECK (lens IN ('er_compliance','standards','constructability','procurement','clash','contract_review'));
