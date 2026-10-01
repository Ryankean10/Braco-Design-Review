-- Add archive columns to equipment_items
ALTER TABLE public.equipment_items
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS equipment_items_archived_idx ON public.equipment_items (company_id, archived);
