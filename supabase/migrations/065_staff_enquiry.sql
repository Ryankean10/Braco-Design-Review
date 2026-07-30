-- Migration 065: Staff enquiry email type + reply tracking

ALTER TABLE public.email_inbox
  DROP CONSTRAINT IF EXISTS email_inbox_email_type_check;

ALTER TABLE public.email_inbox
  ADD CONSTRAINT email_inbox_email_type_check
  CHECK (email_type IN ('timesheet','holiday','unknown','staff_enquiry'));

ALTER TABLE public.email_inbox
  DROP CONSTRAINT IF EXISTS email_inbox_status_check;

ALTER TABLE public.email_inbox
  ADD CONSTRAINT email_inbox_status_check
  CHECK (status IN ('pending','processing','processed','failed','ignored','needs_attention','replied'));

ALTER TABLE public.email_inbox
  ADD COLUMN IF NOT EXISTS reply_text    text,
  ADD COLUMN IF NOT EXISTS reply_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS replied_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Allow internal users to update (for replying)
CREATE POLICY IF NOT EXISTS "Internal users can update email inbox"
  ON public.email_inbox FOR UPDATE
  USING (company_id = get_user_company_id() OR is_superadmin());
