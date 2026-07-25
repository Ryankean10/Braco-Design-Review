-- 053: Cost tracker — subscriptions, API usage, hardware, time entries, invoices

-- ── Subscriptions (global overhead) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cost_subscriptions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text        NOT NULL,
  category       text        NOT NULL DEFAULT 'other', -- 'api' | 'hosting' | 'domain' | 'tool' | 'other'
  amount_gbp     numeric(10,2) NOT NULL DEFAULT 0,
  billing_cycle  text        NOT NULL DEFAULT 'monthly', -- 'monthly' | 'annual'
  notes          text,
  active         boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ── Subscription → company allocations ───────────────────────────────────────
-- How to split a subscription cost across companies (pct must sum to ≤100 per sub)
CREATE TABLE IF NOT EXISTS public.cost_subscription_allocations (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  uuid        NOT NULL REFERENCES public.cost_subscriptions(id) ON DELETE CASCADE,
  company_id       uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  allocation_pct   numeric(5,2) NOT NULL DEFAULT 100,
  UNIQUE (subscription_id, company_id)
);

-- ── API usage log (auto-populated) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_usage_logs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid        REFERENCES public.companies(id) ON DELETE SET NULL,
  endpoint       text,       -- e.g. 'run-review', 'er-rag', 'help-chat'
  model          text        NOT NULL,
  input_tokens   integer     NOT NULL DEFAULT 0,
  output_tokens  integer     NOT NULL DEFAULT 0,
  cost_usd       numeric(10,6) NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_usage_logs_company_date
  ON public.api_usage_logs (company_id, created_at DESC);

-- ── Hardware costs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cost_hardware (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid        REFERENCES public.companies(id) ON DELETE SET NULL,
  name           text        NOT NULL,
  description    text,
  amount_gbp     numeric(10,2) NOT NULL DEFAULT 0,
  purchase_date  date,
  amortise_months integer,   -- if set, cost is spread monthly over this period
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ── Developer time entries ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cost_time_entries (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid        REFERENCES public.companies(id) ON DELETE SET NULL,
  developer      text        NOT NULL, -- 'Ryan' | 'Max' | free text
  hours          numeric(6,2) NOT NULL DEFAULT 0,
  rate_gbp       numeric(8,2) NOT NULL DEFAULT 0,
  entry_date     date        NOT NULL DEFAULT CURRENT_DATE,
  description    text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ── Invoices ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_number text        NOT NULL,
  period_start   date        NOT NULL,
  period_end     date        NOT NULL,
  status         text        NOT NULL DEFAULT 'draft', -- 'draft' | 'sent' | 'paid'
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  sent_at        timestamptz,
  paid_at        timestamptz
);

CREATE TABLE IF NOT EXISTS public.invoice_line_items (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     uuid        NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description    text        NOT NULL,
  quantity       numeric(10,2) NOT NULL DEFAULT 1,
  unit_price_gbp numeric(10,2) NOT NULL DEFAULT 0,
  total_gbp      numeric(10,2) GENERATED ALWAYS AS (quantity * unit_price_gbp) STORED,
  sort_order     integer     NOT NULL DEFAULT 0
);

-- ── RLS — superadmin only ─────────────────────────────────────────────────────
ALTER TABLE public.cost_subscriptions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_subscription_allocations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_logs                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_hardware                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_time_entries               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items              ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'cost_subscriptions','cost_subscription_allocations','api_usage_logs',
    'cost_hardware','cost_time_entries','invoices','invoice_line_items'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "superadmin_all" ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY "superadmin_all" ON public.%I FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin())',
      tbl
    );
  END LOOP;
END $$;
