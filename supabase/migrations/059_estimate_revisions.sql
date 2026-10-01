-- Revision tracking on estimates
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS revision          integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS root_estimate_id  uuid REFERENCES public.estimates(id) ON DELETE SET NULL;

-- Link estimate plant items back to the plant register for clash detection
ALTER TABLE public.estimate_items
  ADD COLUMN IF NOT EXISTS plant_item_id uuid REFERENCES public.plant_items(id) ON DELETE SET NULL;

-- Index for fast revision lookup
CREATE INDEX IF NOT EXISTS estimates_root_estimate_id_idx ON public.estimates(root_estimate_id);
CREATE INDEX IF NOT EXISTS estimate_items_plant_item_id_idx ON public.estimate_items(plant_item_id);
CREATE INDEX IF NOT EXISTS estimate_items_person_id_idx ON public.estimate_items(person_id);
