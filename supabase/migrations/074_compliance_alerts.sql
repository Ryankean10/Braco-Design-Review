-- Add calibration shortcut columns to plant_items (all nullable, backwards-compatible)
ALTER TABLE public.plant_items
  ADD COLUMN IF NOT EXISTS calibration_date date,
  ADD COLUMN IF NOT EXISTS calibration_due  date;

-- Per-tenant compliance alert settings
CREATE TABLE IF NOT EXISTS public.company_compliance_settings (
  company_id   uuid        PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  warn_days_1  int         NOT NULL DEFAULT 60,
  warn_days_2  int         NOT NULL DEFAULT 30,
  alert_email  text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_compliance_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_compliance_settings_tenant"
  ON public.company_compliance_settings FOR ALL
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  ));
