ALTER TABLE public.email_inbox
  DROP CONSTRAINT IF EXISTS email_inbox_email_type_check;

ALTER TABLE public.email_inbox
  ADD CONSTRAINT email_inbox_email_type_check
  CHECK (email_type IN ('timesheet','holiday','unknown','staff_enquiry','haulage_reply'));
