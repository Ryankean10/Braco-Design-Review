-- Migration 052: Email inbox tracking
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.email_inbox (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid        REFERENCES public.companies(id) ON DELETE SET NULL,
  gmail_message_id    text        UNIQUE NOT NULL,
  gmail_thread_id     text,
  received_at         timestamptz NOT NULL,
  from_email          text        NOT NULL,
  from_name           text,
  subject             text,
  body_text           text,
  -- Processing
  status              text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','processing','processed','failed','ignored')),
  email_type          text        CHECK (email_type IN ('timesheet','holiday','unknown')),
  parsed_data         jsonb,
  error_message       text,
  -- Linked records
  person_id           uuid        REFERENCES public.people(id) ON DELETE SET NULL,
  linked_timesheet_id uuid        REFERENCES public.weekly_timesheets(id) ON DELETE SET NULL,
  linked_holiday_id   uuid        REFERENCES public.holiday_bookings(id) ON DELETE SET NULL,
  -- Audit
  processed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Index for quick status queries
CREATE INDEX IF NOT EXISTS email_inbox_status_idx ON public.email_inbox(status);
CREATE INDEX IF NOT EXISTS email_inbox_company_idx ON public.email_inbox(company_id);

-- RLS
ALTER TABLE public.email_inbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company admins can view email inbox"
  ON public.email_inbox FOR SELECT
  USING (company_id = get_user_company_id() OR is_superadmin());

-- Add source column to weekly_timesheets so we know if it came from email
ALTER TABLE public.weekly_timesheets
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'
  CHECK (source IN ('manual','email'));

-- Add source to holiday_bookings too
ALTER TABLE public.holiday_bookings
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'
  CHECK (source IN ('manual','email'));
