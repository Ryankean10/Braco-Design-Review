-- Discrepancy flags and manager sign-off on timesheet entries
ALTER TABLE public.timesheet_entries
  ADD COLUMN IF NOT EXISTS discrepancy_flag    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discrepancy_note    text,
  ADD COLUMN IF NOT EXISTS signed_off_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signed_off_at       timestamptz,
  ADD COLUMN IF NOT EXISTS signed_off_name     text; -- denormalised for audit trail display

-- Allow quickly finding entries that need attention
CREATE INDEX IF NOT EXISTS tse_flag_idx    ON public.timesheet_entries(discrepancy_flag) WHERE discrepancy_flag = true;
CREATE INDEX IF NOT EXISTS tse_signoff_idx ON public.timesheet_entries(signed_off_by);
