CREATE TABLE IF NOT EXISTS public.payment_milestones (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid         NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  estimate_id  uuid         REFERENCES public.estimates(id) ON DELETE SET NULL,
  company_id   uuid         NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  label        text         NOT NULL,
  amount       numeric(12,2),
  currency     text         NOT NULL DEFAULT 'GBP',
  agreed_date  date,
  due_date     date,
  status       text         NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','invoiced','paid','overdue')),
  invoice_ref  text,
  notes        text,
  created_by   uuid         REFERENCES auth.users(id),
  created_at   timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_milestones_tenant"
  ON public.payment_milestones FOR ALL
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS payment_milestones_project_id_idx ON public.payment_milestones (project_id);
CREATE INDEX IF NOT EXISTS payment_milestones_due_date_idx   ON public.payment_milestones (due_date)
  WHERE status IN ('pending','invoiced');
