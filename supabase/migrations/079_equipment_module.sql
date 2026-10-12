-- 079: Equipment module — test equipment, assets, hire items with calibration tracking

CREATE TABLE IF NOT EXISTS public.equipment_items (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name                text        NOT NULL,
  asset_ref           text,
  serial_number       text,
  manufacturer        text,
  model               text,
  category            text        NOT NULL DEFAULT 'Test Equipment'
                                  CHECK (category IN (
                                    'Test Equipment', 'Safety Equipment',
                                    'Survey Equipment', 'Tool', 'Vehicle', 'Other'
                                  )),
  ownership           text        NOT NULL DEFAULT 'Owned'
                                  CHECK (ownership IN ('Owned', 'Hired')),
  hire_company        text,
  hire_return_date    date,
  calibration_date    date,
  calibration_expiry  date,       -- defaults to calibration_date + 12 months if not set
  cert_storage_path   text,
  cert_file_name      text,
  cert_file_size      bigint,
  notes               text,
  created_by          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment_items ENABLE ROW LEVEL SECURITY;

-- Company users can read their own equipment
CREATE POLICY "equipment_company_read" ON public.equipment_items
  FOR SELECT USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR public.is_superadmin()
  );

-- Admins, superadmins, and project managers can mutate
CREATE POLICY "equipment_company_write" ON public.equipment_items
  FOR ALL USING (
    (
      company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('admin', 'superadmin', 'project_manager')
      )
    )
    OR public.is_superadmin()
  );
